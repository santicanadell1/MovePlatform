import { GoodSize } from '@move/shared';

export interface GoodProps {
  readonly id: string;
  readonly reservationId: string;
  readonly description: string;
  readonly value: number | null;
  readonly size: GoodSize | null;
  readonly quantity: number;
  readonly categoryId: string | null;
  readonly productId: string | null;
  readonly classificationStrategy: string | null;
  readonly classificationConfidence: number | null;
  readonly createdAt: Date;
}

export class Good {
  readonly id: string;
  readonly reservationId: string;
  readonly description: string;
  readonly value: number | null;
  readonly size: GoodSize | null;
  readonly quantity: number;
  readonly categoryId: string | null;
  readonly productId: string | null;
  readonly classificationStrategy: string | null;
  readonly classificationConfidence: number | null;
  readonly createdAt: Date;

  private constructor(props: GoodProps) {
    this.id = props.id;
    this.reservationId = props.reservationId;
    this.description = props.description;
    this.value = props.value;
    this.size = props.size;
    this.quantity = props.quantity;
    this.categoryId = props.categoryId;
    this.productId = props.productId;
    this.classificationStrategy = props.classificationStrategy;
    this.classificationConfidence = props.classificationConfidence;
    this.createdAt = props.createdAt;
  }

  static create(props: GoodProps): Good {
    return new Good(props);
  }

  withCategoryId(categoryId: string): Good {
    return Good.create({ ...this, categoryId });
  }
}
