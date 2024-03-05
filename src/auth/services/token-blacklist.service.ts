import { Injectable } from '@nestjs/common';
import { TokenBlacklistRepository } from '../repositories';

@Injectable()
export class TokenBlacklistService {
  constructor(
    private readonly tokenBlacklistRepository: TokenBlacklistRepository,
  ) {}
  // 블랙리스트 토큰 추가
  async addToBlacklist(
    token: string,
    jti: string,
    type: 'access' | 'refresh',
    expiresAt: Date,
  ): Promise<void> {
    await this.tokenBlacklistRepository.addToken(token, jti, type, expiresAt);
  }
  // 특정 jwt id 블랙리스트 인지 확인
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return await this.tokenBlacklistRepository.isTokenBlacklisted(jti);
  }
  // 만료된 토큰 제거
  async removeExpiredTokens(): Promise<void> {
    await this.tokenBlacklistRepository.removeExpiredTokens();
  }
}
