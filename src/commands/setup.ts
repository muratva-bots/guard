import { GuardClass, GuildModel } from '@/models';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    Interaction,
    Message,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    codeBlock,
    inlineCode,
    roleMention,
} from 'discord.js';

const muscles = [
    { name: 'URL Koruması', value: 'url' },
    { name: 'Yetkileri Kapatma', value: 'disablePerms' },
    { name: 'Sunucu Ayar Koruması', value: 'general' },
    { name: 'Rol Koruması', value: 'role' },
    { name: 'Kanal Koruması', value: 'channel' },
    { name: 'Emoji Koruması', value: 'emoji' },
    { name: 'Çıkartma Koruması', value: 'sticker' },
    { name: 'Yasaklama & Atma Koruması', value: 'banKick' },
    { name: 'Webhook Koruması', value: 'webhook' },
    { name: 'Web Koruması', value: 'web' },
    { name: 'Çevrimdışı Koruması', value: 'offline' },
    { name: 'Bot Ekleme Koruması', value: 'bot' },
    { name: 'Bağlantı Kesme Koruması', value: 'voiceKick' },
];

const Setup: Guard.ICommand = {
    usages: ['setup'],
    execute: async ({ client, message, guildData }) => {
        const row = new ActionRowBuilder<StringSelectMenuBuilder>({
            components: [
                new StringSelectMenuBuilder({
                    custom_id: 'guard-setup',
                    placeholder: 'Ayar seçilmemiş!',
                    maxValues: muscles.length,
                    options: muscles.map((m) => ({
                        label: m.name,
                        value: m.value,
                        emoji: {
                            id: guildData[m.value] ? '1118846618259693638' : '1118834136858243112',
                        },
                    })),
                }),
            ],
        });

        const rowTwo = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    label: 'Karantina Rolü Ayarla',
                    custom_id: 'quarantineRole',
                    style: ButtonStyle.Danger,
                    emoji: {
                        id: '1135214115804172338',
                    },
                }),
            ],
        });

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

        const question = await message.channel.send({
            embeds: [embed.setDescription(createContent(client.utils.vanityClient, message, guildData))],
            components: [row, rowTwo],
        });

        const filter = (i: Interaction) => i.user.id === message.author.id && (i.isStringSelectMenu() || i.isButton());
        const collector = question.createMessageComponentCollector({
            filter,
            time: 1000 * 60 * 5,
        });

        collector.on('collect', async (i: Interaction) => {
            if (i.isButton() && i.customId === 'quarantineRole') {
                const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>({
                    components: [
                        new RoleSelectMenuBuilder({
                            custom_id: 'role',
                            placeholder: 'Rol ara...',
                        }),
                    ],
                });

                i.reply({
                    content: 'Karantina rolünü seçin.',
                    components: [roleRow],
                    ephemeral: true,
                });

                const interactionMessage = await i.fetchReply();
                const collected = await interactionMessage.awaitMessageComponent({
                    time: 1000 * 60 * 2,
                    componentType: ComponentType.RoleSelect,
                });
                if (collected) {
                    collected.deferUpdate();

                    const roleId = collected.values[0];

                    question.edit({
                        embeds: [embed.setDescription(createContent(client.utils.vanityClient, message, guildData))],
                        components: [row, rowTwo],
                    });

                    i.editReply({
                        content: `Karantina rolü ${roleMention(roleId)} (${inlineCode(roleId)}) şeklinde ayarlandı.`,
                        components: [],
                    });

                    guildData.quarantineRole = roleId;
                    await GuildModel.updateOne(
                        { id: message.guildId },
                        { $set: { 'guard.quarantineRole': roleId } },
                        { upsert: true },
                    );
                } else i.deleteReply();
                return;
            }

            if (i.isStringSelectMenu()) {
                i.deferUpdate();

                i.values.forEach((v) => {
                    const muscle = muscles.find((m) => m.value === v);
                    guildData[muscle.value] = !guildData[muscle.value];
                });

                row.components[0].setOptions(
                    muscles.map((m) => ({
                        label: m.name,
                        value: m.value,
                        emoji: {
                            id: guildData[m.value] ? '1118846618259693638' : '1118834136858243112',
                        },
                    })),
                );

                question.edit({
                    embeds: [embed.setDescription(createContent(client.utils.vanityClient, message, guildData))],
                    components: [row, rowTwo],
                });

                await GuildModel.updateOne({ id: message.guildId }, { $set: { guard: guildData } }, { upsert: true });
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                const row = new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            custom_id: 'button-end',
                            label: 'Mesajın Geçerlilik Süresi Doldu.',
                            emoji: { name: '⏱️' },
                            style: ButtonStyle.Danger,
                            disabled: true,
                        }),
                    ],
                });

                question.edit({ components: [row] });
            }
        });
    },
};

export default Setup;

function createContent(vanityClient: boolean, message: Message, guildData: GuardClass) {
    return [
        `Merhaba ${message.author} (${inlineCode(message.author.id)}) koruma botu yönetim menüsüne hoşgeldin,\n`,
        `${inlineCode('𝓲')} Aşağıda bulunan menüden korumaları açabilir veya kapatabilirsin.\n`,
        codeBlock(
            'yaml',
            [
                `# ${message.guild.name} Sunucusunun Koruma Sistemi (Sistem Durumu: ${
                    muscles.some((m) => guildData[m.value]) ? 'Açık!' : 'Kapalı!'
                })`,
                muscles
                    .filter((m) => (m.value === 'url' ? !!vanityClient : true))
                    .map((m) => `→ ${m.name}: ${guildData[m.value] ? '🟢 Açık!' : '🔴 Kapalı!'}`)
                    .join('\n'),
                `→ Karantina Rolü: ${message.guild.roles.cache.get(guildData.quarantineRole)?.name || 'Ayarlanmamış.'}`,
            ].join('\n'),
        ),
    ].join('\n');
}
