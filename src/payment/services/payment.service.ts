import { HttpStatus, Injectable } from '@nestjs/common';
import { Order, OrderItem } from '../entities';
import { CreateOrderDto } from '../dto/create-order.dto';
import { BusinessException } from '../../exception';
import { ProductService } from './product.service';
import {
  IssuedCouponRepository,
  OrderRepository,
  PointRepository,
  ShippingInfoRepository,
} from '../repositories';
import { Transactional } from 'typeorm-transactional';

@Injectable()
export class PaymentService {
  constructor(
    private readonly issuedCouponRepository: IssuedCouponRepository,
    private readonly pointRepository: PointRepository,
    private readonly productService: ProductService,
    private readonly shippingInfoRepository: ShippingInfoRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  @Transactional()
  async initOrder(dto: CreateOrderDto): Promise<Order> {
    // 주문 금액 계산
    const totalAmount = await this.calculateTotalAmount(dto.orderItems);

    // 할인 적용
    const finalAmount = await this.applyDiscounts(
      totalAmount,
      dto.userId,
      dto.couponId,
      dto.pointAmountToUse,
    );

    // 주문 생성
    return this.createOrder(
      dto.userId,
      dto.orderItems,
      finalAmount,
      dto.shippingAddress,
    );
  }

  @Transactional()
  async completeOrder(orderId: string): Promise<Order> {
    // 주문 완료 처리
    return this.orderRepository.completeOrder(orderId);
  }

  private async createOrder(
    userId: string,
    orderItems: OrderItem[],
    finalAmount: number,
    shippingAddress?: string,
  ): Promise<Order> {
    // 배송 정보 생성
    const shippingInfo = shippingAddress
      ? await this.shippingInfoRepository.createShippingInfo(shippingAddress)
      : null;
    // 주문 생성
    return await this.orderRepository.createOrder(
      userId,
      orderItems,
      finalAmount,
      shippingInfo,
    );
  }

  private async calculateTotalAmount(orderItems: OrderItem[]): Promise<number> {
    // 총 주문 금액 계산 초기화
    let totalAmount = 0;
    // 주문에 포함된 상품의 id 추출
    const productIds = orderItems.map((item) => item.productId);
    // 상품 서비스를 사용하여 상품 정보 가져오기
    const products = await this.productService.getProductsByIds(productIds);
    // 각 주문 항목에 대해 반복하면서 총 주문 금액 계산
    for (const item of orderItems) {
      // 상품 ID로 해당 상품 찾기
      const product = products.find((p) => p.id === item.productId);
      // 상품 존재 X 예외 처리
      if (!product) {
        throw new BusinessException(
          'payment',
          `Product with ID ${item.productId} not found`,
          'Invalid product',
          HttpStatus.BAD_REQUEST,
        );
      }
      // 총 주문 금액 처리
      totalAmount += product.price * item.quantity;
    }

    return totalAmount;
  }

  private async applyDiscounts(
    totalAmount: number,
    userId: string,
    couponId?: string,
    pointAmountToUse?: number,
  ): Promise<number> {
    // 쿠폰 id가 존재하는 경우 할인 금액 계산
    const couponDiscount = couponId
      ? await this.applyCoupon(couponId, userId, totalAmount)
      : 0;

    // 포인트 사용량 존재하는 경우 할인 금액 계산
    const pointDiscount = pointAmountToUse
      ? await this.applyPoints(pointAmountToUse, userId)
      : 0;

    // 최종 금액 계산
    const finalAmount = totalAmount - (couponDiscount + pointDiscount);
    // 최종 금액 - 인 경우 0 설정
    return finalAmount < 0 ? 0 : finalAmount;
  }

  private async applyCoupon(
    couponId: string,
    userId: string,
    totalAmount: number,
  ): Promise<number> {
    // 주어진 쿠폰id 와 사용자 id 기반 쿠폰 조회
    const issuedCoupon = await this.issuedCouponRepository.findOne({
      where: {
        coupon: { id: couponId },
        user: { id: userId },
      },
    });
    // 발급된 쿠폰 X 시 예외 처리
    if (!issuedCoupon) {
      throw new BusinessException(
        'payment',
        `user doesn't have coupon. couponId: ${couponId} userId: ${userId}`,
        'Invalid coupon',
        HttpStatus.BAD_REQUEST,
      );
    }
    // 쿠폰 유효성 확인
    const isValid =
      issuedCoupon?.isValid &&
      issuedCoupon?.validFrom <= new Date() &&
      issuedCoupon?.validUntil > new Date();
    if (!isValid) {
      throw new BusinessException(
        'payment',
        `Invalid coupon type. couponId: ${couponId} userId: ${userId}`,
        'Invalid coupon',
        HttpStatus.BAD_REQUEST,
      );
    }
    // 쿠폰 유형에 따라 할인 금액 계산
    const { coupon } = issuedCoupon;
    if (coupon.type === 'percent') {
      return (totalAmount * coupon.value) / 100;
    } else if (coupon.type === 'fixed') {
      return coupon.value;
    }
    // 기타 유형의 경우 0 반환
    return 0;
  }

  private async applyPoints(
    pointAmountToUse: number,
    userId: string,
  ): Promise<number> {
    // 사용자 id 기반 사용 가능 포인트 조회
    const point = await this.pointRepository.findOne({
      where: { user: { id: userId } },
    });
    // 조회된 포인트가 없거나 사용 가능한 포인트 < 요청한 포인트 시 예외 처리
    if (point.availableAmount < 0 || point.availableAmount < pointAmountToUse) {
      throw new BusinessException(
        'payment',
        `Invalid points amount ${point.availableAmount}`,
        'Invalid points',
        HttpStatus.BAD_REQUEST,
      );
    }
    // 요청한 포인트 값 반환
    return pointAmountToUse;
  }
}
