import { EntityManager, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { ShippingInfo } from '../entities';

@Injectable()
export class ShippingInfoRepository extends Repository<ShippingInfo> {
  constructor(
    @InjectRepository(ShippingInfo)
    private readonly repo: Repository<ShippingInfo>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  async createShippingInfo(shippingAddress: string): Promise<ShippingInfo> {
    const shippingInfo = new ShippingInfo();
    shippingInfo.address = shippingAddress; // 주소 설정
    shippingInfo.status = 'ordered'; // 상태 설정
    return this.entityManager.save(shippingInfo); // 배송 정보 저장
  }
}
