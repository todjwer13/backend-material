import { EntityManager, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { Order, OrderItem, ShippingInfo } from '../entities';
import { UserRepository } from '../../auth/repositories';
import { IssuedCouponRepository } from './issued-coupon.repository';
import { PointRepository } from './point.repository';

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly userRepository: UserRepository,
    private readonly pointRepository: PointRepository,
    private readonly issuedCouponRepository: IssuedCouponRepository,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  async createOrder(
    userId: string,
    orderItems: OrderItem[],
    finalAmount: number,
    shippingInfo?: ShippingInfo,
  ): Promise<Order> {
    // userId로 사용자 찾기
    const user = await this.userRepository.findOne({ where: { id: userId } });
    // 주문 생성
    const order = new Order();
    order.user = user;
    order.amount = finalAmount;
    order.status = 'started';
    order.items = orderItems;
    order.shippingInfo = shippingInfo;
    // 주문 저장 후 반환
    return this.save(order);
  }

  async completeOrder(orderId: string): Promise<Order> {
    // orderId로 주문 찾기
    const order = await this.findOne({ where: { id: orderId } });
    // 주문 상태 paid로 변경
    order.status = 'paid';
    // 사용된 쿠폰 사용 처리 및 쿠폰 적용
    await Promise.all([
      this.issuedCouponRepository.use(order.usedIssuedCoupon),
      this.pointRepository.use(
        order.user.id,
        order.pointAmountUsed,
        '주문 사용',
      ),
    ]);
    // 변경된 주문 정보 저장 및 반환
    return this.save(order);
  }
}
