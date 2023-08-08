import { SafeFlags } from '@/enums';
import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import { PermissionsString } from 'discord.js';

interface IPermission {
    name: string;
    allow: PermissionsString[];
}

export interface ISafe {
    id: string;
    allow: SafeFlags[];
}

interface IStaff {
    id: string;
    roles: string[];
}

export class GuardClass {
    generalLimitTime: number;
    generalLimitCount: number;
    roleLimitTime: number;
    roleLimitCount: number;
    channelLimitTime: number;
    channelLimitCount: number;
    emojiLimitTime: number;
    emojiLimitCount: number;
    stickerLimitTime: number;
    stickerLimitCount: number;
    banKickLimitTime: number;
    banKickLimitCount: number;
    voiceKickLimitTime: number;
    voiceKickLimitCount: number;
    permissions: IPermission[];
    safes: ISafe[];
    url: boolean;
    disablePerms: boolean;
    general: boolean;
    voiceKick: boolean;
    role: boolean;
    channel: boolean;
    emoji: boolean;
    sticker: boolean;
    banKick: boolean;
    webhook: boolean;
    web: boolean;
    offline: boolean;
    bot: boolean;
    lastChannelDistribution: number;
    lastRoleDistribution: number;
    lastBackup: number;
    danger: boolean;
    staffs: IStaff[];
    quarantineRole: string;
}

@modelOptions({ options: { customName: 'Guilds', allowMixed: 0 } })
export class GuildClass {
    @prop({ type: () => String, required: true, unique: true })
    public id!: string;

    @prop({
        type: Object,
        default: {
            needName: true,
            registerSystem: true,
            invasionProtection: true,
            needAge: true,
            removeWarnRole: true,
            compliment: true,
            changeName: true,
            minAgePunish: true,
            maxMuteSystem: true,
        },
    })
    public moderation: object;

    @prop({ type: Object, default: {} })
    public guard: GuardClass;

    @prop({ type: Object, default: {} })
    public point: object;
}

export const GuildModel = getModelForClass(GuildClass);
