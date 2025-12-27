import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Tenant } from "./Tenant.entity.js";
import { Ticket } from "./Ticket.entity.js";

@Entity("whatsapp_instances")
export class WhatsappInstance {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 20, default: "DISCONNECTED" })
  status!: string;

  @Column({ type: "text", nullable: true })
  qrcode!: string;

  @Column({ type: "boolean", default: false })
  isDefault!: boolean;

  @Column({ type: "uuid" })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.whatsappInstances)
  tenant!: Tenant;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.tenant)
  tickets!: Ticket[];
}
