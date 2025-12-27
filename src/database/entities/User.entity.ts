import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Queue } from "./Queue.entity.js";
import { Tenant } from "./Tenant.entity.js";
import { Ticket } from "./Ticket.entity.js";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "varchar", length: 20, default: "agent" })
  role!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.users)
  tenant!: Tenant;

  @ManyToMany(() => Queue, (queue) => queue.users)
  @JoinTable({ name: "user_queues" })
  queues!: Queue[];

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.tenant)
  tickets!: Ticket[];
}
