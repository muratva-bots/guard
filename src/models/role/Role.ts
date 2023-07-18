import { Schema, model } from "mongoose";
import { IRole } from "./dto";

const roleSchema = new Schema({
	name: String,
	id: String,
	color: Number,
	position: Number,
	permissions: String,
	channelOverwrites: Array,
	members: Array,
	hoist: Boolean,
	mentionable: Boolean,
});

export const RoleModel = model<IRole>("Role", roleSchema);
