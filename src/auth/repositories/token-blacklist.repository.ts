import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { TokenBlacklist } from '../entities';

@Injectable()
export class TokenBlacklistRepository extends Repository<TokenBlacklist> {
  constructor(
    @InjectRepository(TokenBlacklist)
    private readonly repo: Repository<TokenBlacklist>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }
  // 토큰 블랙리스트 추가
  async addToken(
    token: string,
    jti: string,
    tokenType: 'access' | 'refresh',
    expiresAt: Date,
  ): Promise<void> {
    const blacklistedToken = new TokenBlacklist();
    blacklistedToken.token = token;
    blacklistedToken.jti = jti;
    blacklistedToken.tokenType = tokenType;
    blacklistedToken.expiresAt = expiresAt;
    await this.save(blacklistedToken);
  }
  // JWT id로 토큰이 블랙리스트에 있는지 확인
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const foundToken = await this.findOne({ where: { jti } });
    return !!foundToken;
  }
  // 만료된 토큰을 삭제
  async removeExpiredTokens(): Promise<void> {
    await this.createQueryBuilder()
      .delete()
      .from(TokenBlacklist)
      .where('expiresAt < NOW()')
      .execute();
  }
}
