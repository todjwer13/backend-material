import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Point } from '../entities';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { PointLogRepository } from './point-log.repository';

@Injectable()
export class PointRepository extends Repository<Point> {
  constructor(
    @InjectRepository(Point)
    private readonly repo: Repository<Point>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly pointLogRepository: PointLogRepository,
  ) {
    super(repo.target, repo.manager, repo.queryRunner);
  }

  async use(userId, amountToUse: number, reason: string): Promise<Point> {
    const point = await this.findOne({ where: { user: { id: userId } } }); // 사용자 포인트 검색
    point.use(amountToUse); // 포인트 사용 메서드 호출
    await this.pointLogRepository.use(point, amountToUse, reason); // 포인트 이력 생성
    return this.save(point); // 변경 사항을 저장 업데이트 포인트 반환
  }
}
