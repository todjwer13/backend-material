import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { IssuedCoupon } from '../entities';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class IssuedCouponRepository extends Repository<IssuedCoupon> {
  constructor(
    @InjectRepository(IssuedCoupon)
    private readonly repo: Repository<IssuedCoupon>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }
  // 쿠폰 사용 처리및 업데이트된 쿠폰 반환
  use(issuedCoupon: IssuedCoupon): Promise<IssuedCoupon> {
    issuedCoupon.use();
    return this.save(issuedCoupon);
  }
}
