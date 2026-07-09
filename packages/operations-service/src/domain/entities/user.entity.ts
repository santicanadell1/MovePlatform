import { UserRole } from '@move/shared';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface UserProps {
  readonly id: string;
  readonly firebaseUid: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly firebaseUid: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.firebaseUid = props.firebaseUid;
    this.name = props.name;
    this.role = props.role;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: UserProps): User {
    return new User(props);
  }

  withStatus(status: UserStatus): User {
    return User.create({ ...this, status, updatedAt: new Date() });
  }
}
