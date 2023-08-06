import { ChannelType, OverwriteType } from 'discord.js';
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';

export interface IPermissionOverwrites {
    id: string;
    type: OverwriteType;
    permissions: Guard.IPermissions;
}

@modelOptions({ options: { customName: 'Channels', allowMixed: 0 } })
export class ChannelClass {
    @prop({ type: () => String, required: true, unique: true })
    public id!: string;

    @prop({ type: () => String, required: true })
    public guild!: string;

    @prop({ type: () => String, required: true })
    public name!: string;

    @prop({ type: () => Number, required: true })
    public type!: Exclude<
        ChannelType,
        | ChannelType.DM
        | ChannelType.GroupDM
        | ChannelType.PublicThread
        | ChannelType.AnnouncementThread
        | ChannelType.PrivateThread
    >;

    @prop({ type: () => String, default: undefined })
    public parent?: string;

    @prop({ type: () => String, default: undefined })
    public topic?: string;

    @prop({ type: () => Number, required: true })
    public position!: number;

    @prop({ type: () => Number, default: undefined })
    public userLimit?: number;

    @prop({ type: () => Boolean, default: undefined })
    public nsfw?: boolean;

    @prop({ type: () => [Object], default: [] })
    public permissionOverwrites!: IPermissionOverwrites[];

    @prop({ type: () => Number, default: undefined })
    public rateLimitPerUser?: number;

    @prop({ type: () => Number, default: undefined })
    public bitrate?: number;
}

export const ChannelModel = getModelForClass(ChannelClass);
