import { AccessTokenRepository, UserRepository } from '../repositories';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { User } from '../entities';
import { CreateUserDto } from '../dto';
import { BusinessException } from '../../exception';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly accessTokenRepo: AccessTokenRepository,
  ) {}
  // 사용자 생성
  async createUser(dto: CreateUserDto): Promise<User> {
    // 이메일로 사용자 조회
    const user = await this.userRepo.findOneByEmail(dto.email);
    // 이미 존재하면 예외 처리
    if (user) {
      throw new BusinessException(
        'user',
        `${dto.email} already exist`,
        `${dto.email} already exist`,
        HttpStatus.BAD_REQUEST,
      );
    }
    // 비밀번호 암호화
    const hashedPassword = await argon2.hash(dto.password);
    // 사용자 생성 후 반환
    return this.userRepo.createUser(dto, hashedPassword);
  }
  // 사용자 검증
  async validateUser(id: string, jti: string): Promise<User> {
    // 사용자 토큰 조회
    const [user, token] = await Promise.all([
      this.userRepo.findOneBy({ id }),
      this.accessTokenRepo.findOneByJti(jti),
    ]);
    // 사용자가 존재하지 않을 경우 예외 처리
    if (!user) {
      this.logger.error(`user ${id} not found`);
      throw new BusinessException(
        'user',
        `user not found`,
        `user not found`,
        HttpStatus.BAD_REQUEST,
      );
    }
    // 토큰이 존재하지 않을 경우 예외 처리
    if (!token) {
      this.logger.error(`jti ${jti} token is revoked`);
      throw new BusinessException(
        'user',
        `revoked token`,
        `revoked token`,
        HttpStatus.BAD_REQUEST,
      );
    }
    // 다 유효시 사용자 반환
    return user;
  }
}
