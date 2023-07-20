import { Schema, model } from 'mongoose';

export interface IChannelOverwrite {
    id: string;
    permissions: Guard.IPermissions;
}

export interface IRole {
    guild: string;
    name: string;
    id: string;
    color: number;
    position: number;
    permissions: string;
    channelOverwrites: IChannelOverwrite[];
    members: string[];
    hoist: boolean;
    mentionable: boolean;
}

const roleSchema = new Schema({
    name: String,
    guild: String,
    id: String,
    color: Number,
    position: Number,
    permissions: String,
    channelOverwrites: Array,
    members: Array,
    hoist: Boolean,
    mentionable: Boolean,
});

export const RoleModel = model<IRole>('Role', roleSchema);
