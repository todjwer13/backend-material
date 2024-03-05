import { Injectable } from '@nestjs/common';
import { Product } from '../entities';
import { ProductRepository } from '../repositories';

@Injectable()
export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    // 제품 조회 및 반환
    return await this.productRepository.getProductsByIds(productIds);
  }
}
