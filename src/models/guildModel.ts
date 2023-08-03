import { SafeFlags } from '@/enums';
import { prop, getModelForClass, modelOptions } from '@typegoose/typegoose';
import { PermissionsString } from 'discord.js';

interface IPermission {
    name: string;
    allow: PermissionsString[];
}

interface ISafe {
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
    role: boolean;
    channel: boolean;
    emoji: boolean;
    sticker: boolean;
    banKick: boolean;
    webhook: boolean;
    web: boolean;
    offline: boolean;
    bot: boolean;
    lastChannelControl: number;
    lastRoleControl: number;
    lastBackup: number;
    danger: boolean;
    staffs: IStaff[]
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
}

export const GuildModel = getModelForClass(GuildClass);