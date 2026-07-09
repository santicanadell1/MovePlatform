import { ClientType, UserRole } from '@move/shared';

export interface UserProps {
  readonly id: string;
  readonly firebaseUid: string;
  readonly role: UserRole;
  readonly type: ClientType;
  readonly name: string;
  readonly email: string;
  readonly companyName: string | null;
  readonly phone: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly firebaseUid: string;
  readonly role: UserRole;
  readonly type: ClientType;
  readonly name: string;
  readonly email: string;
  readonly companyName: string | null;
  readonly phone: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.firebaseUid = props.firebaseUid;
    this.role = props.role;
    this.type = props.type;
    this.name = props.name;
    this.email = props.email;
    this.companyName = props.companyName;
    this.phone = props.phone;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
