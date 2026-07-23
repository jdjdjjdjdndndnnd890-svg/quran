const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags 
} = require('discord.js');

const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus, 
    entersState, 
    getVoiceConnection 
} = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// قائمة القراء
const reciters = {
    'العفاسي': 'https://server8.mp3quran.net/afs/',
    'المنشاوي': 'https://server11.mp3quran.net/minsh/',
    'البسطامي': 'https://server10.mp3quran.net/basit/'
};

let currentReciterKey = 'العفاسي';
let mainReciter = reciters[currentReciterKey];
let mainSurahIndex = 1;
let isCustomRequest = false;
let panelMessageData = { channelId: null, messageId: null };

const player = createAudioPlayer();
let connection = null;

// دالة لتوليد رابط السورة (3 أرقام مثل 001.mp3)
function getSurahUrl(reciterBaseUrl, surahNum) {
    const formattedNum = String(surahNum).padStart(3, '0');
    return `${reciterBaseUrl}${formattedNum}.mp3`;
}

function playSurahStream(surahNum, reciterUrl) {
    const url = getSurahUrl(reciterUrl, surahNum);
    const resource = createAudioResource(url);
    player.play(resource);
}

// الانتقال التلقائي للسورة التالية عند انتهاء الحالية
player.on(AudioPlayerStatus.Idle, () => {
    if (!isCustomRequest) {
        mainSurahIndex++;
        if (mainSurahIndex > 114) mainSurahIndex = 1;
        playSurahStream(mainSurahIndex, mainReciter);
        updatePanel();
    }
});

player.on('error', error => {
    console.error('❌ خطأ في مشغل الصوت:', error);
});

// تصميم لوحة التحكم (الرسالة التفاعلية)
function createPanelEmbed() {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📖 إذاعة القرآن الكريم المباشرة')
        .setDescription(`القارئ الحالي: **${currentReciterKey}**\nرقم السورة الحالية: **${mainSurahIndex} / 114**`)
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_surah').setLabel('السورة السابقة ◀').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('next_surah').setLabel('السورة التالية ▶').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('stop_radio').setLabel('إيقاف ⏹').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

async function updatePanel() {
    if (!panelMessageData.channelId || !panelMessageData.messageId) return;
    try {
        const channel = await client.channels.fetch(panelMessageData.channelId);
        const msg = await channel.messages.fetch(panelMessageData.messageId);
        await msg.edit(createPanelEmbed());
    } catch (e) {}
}

client.once('ready', async () => {
    console.log(`✅ تم تسجيل الدخول بنجاح باسم ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('setup-quran')
            .setDescription('تشغيل إذاعة القرآن الكريم في الروم الصوتية')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('الروم الصوتية المراد التشغيل فيها')
                    .setRequired(true)
            )
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ تم تسجيل أوامر السلاش بنجاح.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-quran') {
            const voiceChannel = interaction.options.getChannel('channel');
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // 1. حذف اللوحة القديمة إن وجدت
            if (panelMessageData.channelId && panelMessageData.messageId) {
                try {
                    const oldChannel = await client.channels.fetch(panelMessageData.channelId);
                    const oldMsg = await oldChannel.messages.fetch(panelMessageData.messageId);
                    await oldMsg.delete();
                } catch (e) {}
            }

            // 2. تدمير أي اتصال صوتي قديم بالكامل
            const oldConn = getVoiceConnection(voiceChannel.guild.id);
            if (oldConn) {
                try {
                    oldConn.disconnect();
                    oldConn.destroy();
                } catch (e) {}
            }

            // 3. إنشاء اتصال صوتي جديد وثابت
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false
            });

            // متابعة حالات الاتصال بدقة لتجنب التعليق
            connection.on('stateChange', (oldState, newState) => {
                console.log(`📡 حالة الاتصال: ${oldState.status} ➔ ${newState.status}`);
            });

            connection.on('error', (err) => {
                console.error('❌ خطأ في الاتصال الصوتي:', err);
            });

            connection.subscribe(player);

            try {
                // الانتظار حتى يتم الاتصال وتأكيد الحالة بنجاح (خلال 20 ثانية)
                await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
                console.log('✅ الاتصال الصوتي جاهز 100%!');
            } catch (error) {
                console.log('⚠️ تأخر استجابة الاتصال، جاري المتابعة رغم ذلك...');
            }

            // 4. إرسال اللوحة وبدء التشغيل
            const panelMsg = await voiceChannel.send(createPanelEmbed());
            panelMessageData = { channelId: voiceChannel.id, messageId: panelMsg.id };

            mainSurahIndex = 1;
            isCustomRequest = false;
            playSurahStream(mainSurahIndex, mainReciter);

            return interaction.editReply({ content: `✅ تم ربط الإذاعة بنجاح في روم **${voiceChannel.name}**!` });
        }
    } else if (interaction.isButton()) {
        if (interaction.customId === 'next_surah') {
            mainSurahIndex++;
            if (mainSurahIndex > 114) mainSurahIndex = 1;
            isCustomRequest = true;
            playSurahStream(mainSurahIndex, mainReciter);
            await interaction.reply({ content: `⏭ تم الانتقال للسورة رقم ${mainSurahIndex}`, flags: MessageFlags.Ephemeral });
            updatePanel();
        } else if (interaction.customId === 'prev_surah') {
            mainSurahIndex--;
            if (mainSurahIndex < 1) mainSurahIndex = 114;
            isCustomRequest = true;
            playSurahStream(mainSurahIndex, mainReciter);
            await interaction.reply({ content: `⏮ تم الانتقال للسورة رقم ${mainSurahIndex}`, flags: MessageFlags.Ephemeral });
            updatePanel();
        } else if (interaction.customId === 'stop_radio') {
            player.stop();
            const conn = getVoiceConnection(interaction.guildId);
            if (conn) conn.destroy();
            await interaction.reply({ content: '⏹ تم إيقاف الإذاعة ومغادرة الروم.', flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
                
