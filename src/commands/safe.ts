import { MentionableSelectMenuBuilder } from '@discordjs/builders';
import { SafeFlags } from '@/enums';
import { GuildModel } from '@/models';
import {
    ActionRowBuilder,
    ComponentType,
    EmbedBuilder,
    MentionableSelectMenuInteraction,
    Role,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    bold,
    codeBlock,
    inlineCode,
} from 'discord.js';

const titles = {
    FULL: {
        name: 'Full',
        description: 'Her şey serbesttir.',
    },
    GENERAL: {
        name: 'Sunucu Ayarları',
        description: 'Sınırlı sunucu ayarı işlemi.',
    },
    ROLE: {
        name: 'Rol',
        description: 'Sınırlı rol işlemi.',
    },
    CHANNEL: {
        name: 'Kanal',
        description: 'Sınırlı rol işlemi.',
    },
    EMOJI: {
        name: 'Emoji',
        description: 'Sınırlı emoji işlemi.',
    },
    STICKER: {
        name: 'Çıkartma',
        description: 'Sınırlı çıkartma işlemi.',
    },
    BAN_KICK: {
        name: 'Yasaklama & Atma',
        description: 'Sınırlı yasaklama & atma işlemi.',
    },
};

const Safe: Guard.ICommand = {
    usages: ['safe', 'güvenli'],
    execute: async ({ client, message, args }) => {
        if (!args[0] || !['liste', 'list', 'ekle', 'add', 'kaldır', 'remove'].some((a) => a === args[0])) {
            message.channel.send({
                content: `Geçerli bir argüman belirt! (${inlineCode('liste')}, ${inlineCode('ekle')} veya ${inlineCode(
                    'kaldır',
                )})`,
            });
            return;
        }

        const embed = new EmbedBuilder({
            color: client.utils.getRandomColor(),
            author: {
                name: message.author.username,
                icon_url: message.author.displayAvatarURL({
                    forceStatic: true,
                    size: 4096,
                }),
            },
        });

        if (['ekle', 'add'].some((a) => args[0] === a)) {
            const mentionableRow = new ActionRowBuilder<MentionableSelectMenuBuilder>({
                components: [
                    new MentionableSelectMenuBuilder({
                        custom_id: 'target',
                        max_values: 25,
                        min_values: 1,
                        placeholder: 'Kullanıcı veya rol ara...',
                    }),
                ],
            });

            const question = await message.channel.send({
                embeds: [embed.setDescription('Aşağıdaki menüden ekleyeceğiniz kullanıcıları belirtin!')],
                components: [mentionableRow],
            });

            const collectedOne = await question.awaitMessageComponent({
                filter: (i: MentionableSelectMenuInteraction) =>
                    i.user.id === message.author.id && i.isMentionableSelectMenu(),
                time: 1000 * 60 * 5,
                componentType: ComponentType.MentionableSelect,
            });
            if (collectedOne) {
                collectedOne.deferUpdate();

                const titleKeys = Object.keys(titles);
                const typeRow = new ActionRowBuilder<StringSelectMenuBuilder>({
                    components: [
                        new StringSelectMenuBuilder({
                            custom_id: 'type',
                            placeholder: 'İzin seçilmemiş',
                            max_values: titleKeys.length,
                            options: titleKeys.map((key) => ({
                                label: titles[key].name,
                                value: key,
                                description: titles[key].description,
                            })),
                        }),
                    ],
                });

                await question.edit({
                    embeds: [embed.setDescription('Aşağıdaki menüden izinleri belirtin!')],
                    components: [typeRow],
                });

                const collectedTwo = await question.awaitMessageComponent({
                    filter: (i: StringSelectMenuInteraction) =>
                        i.user.id === message.author.id && i.isStringSelectMenu(),
                    time: 1000 * 60 * 5,
                    componentType: ComponentType.StringSelect,
                });
                if (collectedTwo) {
                    for (const value of collectedOne.values) {
                        const safe = client.safes.get(value);
                        if (!safe) client.safes.set(collectedOne.values[0], collectedTwo.values as SafeFlags[]);
                        else safe.push(...(collectedTwo.values as SafeFlags[]));
                    }

                    const safes = Array.from(client.safes).map((s) => ({
                        id: s[0],
                        allow: s[1],
                    }));
                    await GuildModel.updateOne(
                        { id: message.guildId },
                        { $set: { 'guard.safes': safes } },
                        { upsert: true },
                    );

                    collectedTwo.reply({
                        content: 'Başarıyla eklendi.',
                        ephemeral: true,
                    });
                    question.delete();
                } else question.delete();
            } else question.delete();
        }

        if (['kaldır', 'remove'].some((a) => args[0] === a)) {
            const target =
                message.guild.roles.cache.get(args[1]) ||
                client.users.cache.get(args[1]) ||
                message.mentions.users.first() ||
                message.mentions.roles.first();

            if (!target) {
                message.channel.send({
                    content: 'Geçerli bir kullanıcı veya rol belirtmedin!',
                });
                return;
            }

            if (!client.safes.get(target.id)) {
                message.channel.send({
                    content: 'Belirttiğin kişi, rol güvenli listesinde zaten bulunmuyor!',
                });
                return;
            }

            const targetName = bold(target instanceof Role ? target.name : target.username);
            const targetType = target instanceof Role ? 'rol' : 'kullanıcı';
            message.channel.send({
                embeds: [
                    embed.setDescription(
                        `${targetName} (${inlineCode(target.id)}) adlı ${targetType} güvenliden çıkarıldı!`,
                    ),
                ],
            });

            client.safes.delete(target.id);

            const safes = Array.from(client.safes).map((s) => ({
                id: s[0],
                allow: s[1],
            }));
            await GuildModel.updateOne(
                { id: message.guildId },
                { $set: { 'guard.safes': safes } },
                { upsert: true },
            );
        }

        if (['liste', 'list'].some((a) => a === args[0])) {
            const safes = [];
            client.safes.forEach((value, id) => {
                const safe = client.users.cache.has(id)
                    ? client.users.cache.get(id)
                    : message.guild.roles.cache.has(id)
                    ? message.guild.roles.cache.get(id)
                    : undefined;
                if (safe) {
                    const titlesOfSafe = [...new Set(value.map((p) => titles[p].name))].join(', ');
                    const entityType = safe instanceof Role ? 'Rol' : 'Kullanıcı';
                    const safeName = safe instanceof Role ? safe.name : safe.username;
                    safes.push(`→ ${safeName} (${entityType}): ${titlesOfSafe}`);
                }
            });
            message.channel.send({
                embeds: [
                    embed.setDescription(
                        [
                            `Merhaba ${message.author} (${inlineCode(
                                message.author.id,
                            )}) koruma botu güvenli listesine hoşgeldin,\n`,
                            codeBlock(
                                'yaml',
                                `# ${message.guild.name} Sunucusunun Güvenli Listesi\n${safes.join('\n')}`,
                            ),
                        ].join('\n'),
                    ),
                ],
            });
        }
    },
};

export default Safe;
