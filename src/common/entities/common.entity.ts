import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class CommonEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', select: false })
  updatedAt: Date;
}

export abstract class CommonDEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', select: false })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', select: false })
  deletedAt: Date;
}

export abstract class CommonCEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

export abstract class OperatorEntity extends CommonEntity {
  @Column({
    comment: '操作人ID',
    name: 'operator_id',
    type: 'int',
    nullable: true,
  })
  operatorId?: number;

  @Column({
    comment: '操作人名称',
    name: 'operator',
    length: 100,
    nullable: true,
  })
  operator?: string;
}
