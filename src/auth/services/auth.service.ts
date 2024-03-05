import { HttpStatus, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  AccessLogRepository,
  AccessTokenRepository,
  RefreshTokenRepository,
  UserRepository,
} from '../repositories';
import { User } from '../entities';
import { BusinessException } from '../../exception';
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginResDto } from '../dto';
import { TokenBlacklistService } from './token-blacklist.service';
import { RequestInfo, TokenPayload } from '../types';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly accessTokenRepository: AccessTokenRepository,
    private readonly accessLogRepository: AccessLogRepository,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  // 로그인 시
  async login(
    email: string,
    plainPassword: string,
    req: RequestInfo,
  ): Promise<LoginResDto> {
    // 사용자 정보를 검증
    const user = await this.validateUser(email, plainPassword);
    // 검증된 사용자의 id로 토큰 페이로드 생성
    const payload: TokenPayload = this.createTokenPayload(user.id);
    // 액세스 토큰, 리프레시 토큰 생성
    const [accessToken, refreshToken] = await Promise.all([
      this.createAccessToken(user, payload),
      this.createRefreshToken(user, payload),
    ]);
    // 로그인 요청에 대한 정보 사용 접근 로그 작성
    const { ip, endpoint, ua } = req;
    await this.accessLogRepository.createAccessLog(user, ua, endpoint, ip);
    // 생성된 토큰, 사용자 정보를 반환
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    };
  }
  // 로그인 처리
  async loginOauth(user: User, req: RequestInfo): Promise<LoginResDto> {
    // 사용자 id로 토큰 페이로드 생성
    const payload: TokenPayload = this.createTokenPayload(user.id);
    // 액세스 토큰과 리프레시 토큰 생성
    const [accessToken, refreshToken] = await Promise.all([
      this.createAccessToken(user, payload),
      this.createRefreshToken(user, payload),
    ]);
    // 로그인 요청 정보 사용자 접근 로그 작성
    const { ip, endpoint, ua } = req;
    await this.accessLogRepository.createAccessLog(user, ua, endpoint, ip);
    // 생성된 토큰, 사용자 정보를 반환
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    };
  }

  // 로그아웃
  async logout(accessToken: string, refreshToken: string): Promise<void> {
    // 액세스 토큰, 리프레시 토큰 검증. 토큰의 jwt id 추출
    const [jtiAccess, jtiRefresh] = await Promise.all([
      this.jwtService.verifyAsync(accessToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }),
      this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }),
    ]);
    // 검증된 토큰을 블랙리스크 추가
    await Promise.all([
      this.addToBlacklist(
        accessToken,
        jtiAccess,
        'access',
        'ACCESS_TOKEN_EXPIRY',
      ),
      this.addToBlacklist(
        refreshToken,
        jtiRefresh,
        'refresh',
        'REFRESH_TOKEN_EXPIRY',
      ),
    ]);
  }

  // 리프레시 토큰을 사용하여 새로운 액세스 토큰 발급
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      // 리프레시 토큰 검증, 페이로드에서 만료시간 제거
      const { exp, ...payload } = await this.jwtService.verifyAsync(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_SECRET'),
        },
      );
      // 페이로드에서 사용자 id 추출 및 사용자 조회
      const user = await this.userRepository.findOneBy({ id: payload.sub });
      if (!user) {
        // 사용자를 찾을수 없을때 예외 처리
        throw new BusinessException(
          'auth',
          'user-not-found',
          'User not found',
          HttpStatus.UNAUTHORIZED,
        );
      }
      // 사용자가 유효한 경우 새로운 액세스 토큰 생성 및 반환
      return this.createAccessToken(user, payload as TokenPayload);
    } catch (error) {
      // 검증 실패시 예외 처리
      throw new BusinessException(
        'auth',
        'invalid-refresh-token',
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  // 사용자 id 기반 토큰 페이로드 생성
  createTokenPayload(userId: string): TokenPayload {
    return {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      jti: uuidv4(),
    };
  }

  // 사용자와 토큰 페이로드를 사용하여 액세스 토큰 생성
  async createAccessToken(user: User, payload: TokenPayload): Promise<string> {
    // 만료시간 설정
    const expiresIn = this.configService.get<string>('ACCESS_TOKEN_EXPIRY');
    // JWT 서비스 사용 액세스 토큰 서명
    const token = this.jwtService.sign(payload, { expiresIn });
    // 액세스 토큰 만료 시간 계산
    const expiresAt = this.calculateExpiry(expiresIn);
    // 액세스 토큰 관련 정보 DB 저장
    await this.accessTokenRepository.saveAccessToken(
      payload.jti,
      user,
      token,
      expiresAt,
    );

    return token;
  }
  // 사용자와 토큰 페이로드를 사용하여 리프레시 토큰 생성(위와 비슷)
  async createRefreshToken(user: User, payload: TokenPayload): Promise<string> {
    const expiresIn = this.configService.get<string>('REFRESH_TOKEN_EXPIRY');
    const token = this.jwtService.sign(payload, { expiresIn });
    const expiresAt = this.calculateExpiry(expiresIn);

    await this.refreshTokenRepository.saveRefreshToken(
      payload.jti,
      user,
      token,
      expiresAt,
    );

    return token;
  }
  // 사용자 검증
  private async validateUser(
    email: string,
    plainPassword: string,
  ): Promise<User> {
    // 이메일을 사용한 DB 조회
    const user = await this.userRepository.findOne({ where: { email } });
    // 사용자가 있는지 확인후 비밀번호 일치 확인
    if (user && (await argon2.verify(user.password, plainPassword))) {
      return user;
    }
    //  사용자가 없거나 인증 오류 예외 처리
    throw new BusinessException(
      'auth',
      'invalid-credentials',
      'Invalid credentials',
      HttpStatus.UNAUTHORIZED,
    );
  }
  // 토큰 블랙리스트 추가
  private async addToBlacklist(
    token: string,
    jti: string,
    type: 'access' | 'refresh',
    expiryConfigKey: string,
  ): Promise<void> {
    const expiryTime = this.calculateExpiry(
      this.configService.get<string>(expiryConfigKey),
    );
    await this.tokenBlacklistService.addToBlacklist(
      token,
      jti,
      type,
      expiryTime,
    );
  }
  // 만료 시간 계산
  private calculateExpiry(expiry: string): Date {
    let expiresInMilliseconds = 0;

    if (expiry.endsWith('d')) {
      const days = parseInt(expiry.slice(0, -1), 10);
      expiresInMilliseconds = days * 24 * 60 * 60 * 1000;
    } else if (expiry.endsWith('h')) {
      const hours = parseInt(expiry.slice(0, -1), 10);
      expiresInMilliseconds = hours * 60 * 60 * 1000;
    } else if (expiry.endsWith('m')) {
      const minutes = parseInt(expiry.slice(0, -1), 10);
      expiresInMilliseconds = minutes * 60 * 1000;
    } else if (expiry.endsWith('s')) {
      const seconds = parseInt(expiry.slice(0, -1), 10);
      expiresInMilliseconds = seconds * 1000;
    } else {
      throw new BusinessException(
        'auth',
        'invalid-expiry',
        'Invalid expiry time',
        HttpStatus.BAD_REQUEST,
      );
    }

    return new Date(Date.now() + expiresInMilliseconds);
  }
}
