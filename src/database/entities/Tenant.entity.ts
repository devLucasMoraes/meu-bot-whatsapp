import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Ticket } from "./Ticket.entity.js";
import { User } from "./User.entity.js";
import { WhatsappInstance } from "./WhatsappInstance.entity.js";

@Entity("tenants")
export class Tenant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 50, unique: true })
  documentNumber!: string;

  @Column({ type: "varchar", length: 20, default: "active" })
  status!: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @OneToMany(() => User, (user) => user.tenant)
  users!: User[];

  @OneToMany(() => WhatsappInstance, (wa) => wa.tenant)
  whatsappInstances!: WhatsappInstance[];

  @OneToMany(() => Ticket, (ticket) => ticket.tenant)
  tickets!: Ticket[];
}
