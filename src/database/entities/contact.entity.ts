import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Tenant } from "./tenant.entity.js";
import { Ticket } from "./ticket.entity.js";

@Entity("contacts")
@Unique(["number", "tenantId"])
export class Contact {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 50 })
  number!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  profilePicUrl!: string;

  @Column({ type: "uuid" })
  tenantId!: string;

  @ManyToOne(() => Tenant)
  tenant!: Tenant;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.tenant)
  tickets!: Ticket[];
}
