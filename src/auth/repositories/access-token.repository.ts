import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { AccessToken, User } from '../entities';

@Injectable()
export class AccessTokenRepository extends Repository<AccessToken> {
  constructor(
    @InjectRepository(AccessToken)
    private readonly repo: Repository<AccessToken>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }
  // 엑세스 토큰 저장
  async saveAccessToken(
    jti: string,
    user: User,
    token: string,
    expiresAt: Date,
  ): Promise<AccessToken> {
    const accessToken = new AccessToken();
    accessToken.jti = jti;
    accessToken.user = user;
    accessToken.token = token;
    accessToken.expiresAt = expiresAt;
    accessToken.isRevoked = false;
    return this.save(accessToken);
  }
  // JWT id로 엑세스 토큰 조회
  async findOneByJti(jti: string): Promise<AccessToken> {
    return this.findOneBy({ jti, isRevoked: false });
  }
}
