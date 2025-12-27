import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Tenant } from "./Tenant.entity.js";
import { Ticket } from "./Ticket.entity.js";
import { User } from "./User.entity.js";

@Entity("queues")
export class Queue {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 20, default: "#000000" })
  color!: string;

  @Column({ type: "text", nullable: true })
  greetingMessage!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @ManyToMany(() => User, (user) => user.queues)
  users!: User[];

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.tenant)
  tickets!: Ticket[];
}
