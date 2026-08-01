import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from 'discord.js-selfbot-v13';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

io.on('connection', (socket) => {
    socket.on('start_clone', async (data) => {
        const { userToken, sourceId, targetId } = data;
        const client = new Client({ checkUpdate: false });

        const log = (msg) => socket.emit('log', msg);
        const progress = (percent) => socket.emit('progress', percent);

        client.on('ready', async () => {
            log(`🟢 Logged in as: ${client.user.tag}`);
            progress(10);

            const sourceGuild = client.guilds.cache.get(sourceId);
            const targetGuild = client.guilds.cache.get(targetId);

            if (!sourceGuild || !targetGuild) {
                log('❌ Error: Source ya Target Server nahi mila!');
                return client.destroy();
            }

            log(`🚀 Cloning Started: ${sourceGuild.name} ➔ ${targetGuild.name}`);
            progress(20);

            try {
                // 1. CLEAR TARGET
                log('🧹 Clearing target server...');
                for (const channel of targetGuild.channels.cache.values()) await channel.delete().catch(()=>{});
                for (const role of targetGuild.roles.cache.values()) {
                    if (role.editable && role.name !== '@everyone') await role.delete().catch(()=>{});
                }
                progress(30);

                // 2. PROFILE
                log('🖼️ Copying Server Profile...');
                await targetGuild.setName(sourceGuild.name).catch(()=>{});
                if (sourceGuild.iconURL()) await targetGuild.setIcon(sourceGuild.iconURL({ dynamic: true, size: 4096 })).catch(()=>{});
                progress(45);

                // 3. ROLES
                log('🎭 Cloning Roles...');
                const roleMap = new Map();
                const sortedRoles = [...sourceGuild.roles.cache.values()].sort((a, b) => a.position - b.position);
                
                for (const role of sortedRoles) {
                    if (role.name === '@everyone') {
                        const everyone = targetGuild.roles.cache.find(r => r.name === '@everyone');
                        if (everyone) await everyone.setPermissions(role.permissions).catch(()=>{});
                        roleMap.set(role.id, everyone.id);
                        continue;
                    }
                    const newRole = await targetGuild.roles.create({
                        name: role.name, color: role.color, hoist: role.hoist, permissions: role.permissions, mentionable: role.mentionable
                    }).catch(() => null);
                    if (newRole) roleMap.set(role.id, newRole.id);
                }
                progress(60);

                // 4. CHANNELS
                log('📁 Cloning Categories & Channels...');
                const catMap = new Map();
                for (const [, cat] of sourceGuild.channels.cache.filter(c => c.type === 'GUILD_CATEGORY').sort((a,b)=>a.position-b.position)) {
                    const newCat = await targetGuild.channels.create(cat.name, { type: 'GUILD_CATEGORY' }).catch(()=>null);
                    if (newCat) catMap.set(cat.id, newCat.id);
                }

                const channelMap = new Map();
                for (const [, ch] of sourceGuild.channels.cache.filter(c => c.type !== 'GUILD_CATEGORY').sort((a,b)=>a.position-b.position)) {
                    const parentId = ch.parentId ? catMap.get(ch.parentId) : null;
                    const newChannel = await targetGuild.channels.create(ch.name, {
                        type: ch.type, topic: ch.topic, nsfw: ch.nsfw, bitrate: ch.bitrate, parent: parentId
                    }).catch(()=>null);
                    if (newChannel) channelMap.set(ch.id, newChannel);
                }
                progress(75);

                // 5. MESSAGES
                log('💬 Cloning Messages (Impersonation)...');
                for (const [sourceId, targetChannel] of channelMap) {
                    const sourceChannel = sourceGuild.channels.cache.get(sourceId);
                    if (sourceChannel && sourceChannel.isText() && targetChannel.isText()) {
                        try {
                            const messages = await sourceChannel.messages.fetch({ limit: 15 });
                            if (messages.size > 0) {
                                const webhook = await targetChannel.createWebhook('Cloner', { avatar: client.user.displayAvatarURL() });
                                const msgArray = Array.from(messages.values()).reverse();
                                for (const msg of msgArray) {
                                    if (msg.content || msg.attachments.size > 0) {
                                        await webhook.send({
                                            content: msg.content || ' ', username: msg.author.username,
                                            avatarURL: msg.author.displayAvatarURL({ dynamic: true }),
                                            files: msg.attachments.map(a => a.url)
                                        }).catch(()=>{});
                                        await sleep(2000); // 2 sec delay anti-ban
                                    }
                                }
                                await webhook.delete().catch(()=>{});
                            }
                        } catch (e) {}
                    }
                }
                
                progress(100);
                log('🎉 MAX CLONING COMPLETELY SUCCESSFUL!');
                client.destroy();

            } catch (err) {
                log(`❌ Error: ${err.message}`);
                client.destroy();
            }
        });

        client.login(userToken).catch(() => log('❌ Invalid User Token!'));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`UI Running on port ${PORT}`));
                  
