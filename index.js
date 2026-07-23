const { 
    Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, 
    TextInputStyle, ChannelType, StringSelectMenuBuilder 
} = require('discord.js');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, VoiceConnectionStatus 
} = require('@discordjs/voice');

// إنشاء العميل وتحديد الصلاحيات (Intents)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// قائمة القراء المتاحين في البانل
const reciters = [
    { id: 'afs', name: 'مشاري العفاسي', url: 'https://server8.mp3quran.net/afs/' },
    { id: 'dosr', name: 'ياسر الدوسري', url: 'https://server11.mp3quran.net/dosr/' },
    { id: 'minsh', name: 'محمد صديق المنشاوي (مجود)', url: 'https://server10.mp3quran.net/minsh/' },
    { id: 'shat', name: 'أبو بكر الشاطري', url: 'https://server11.mp3quran.net/shat/' },
    { id: 'shur', name: 'سعود الشريم', url: 'https://server7.mp3quran.net/shur/' },
    { id: 'sds', name: 'عبد الرحمن السديس', url: 'https://server11.mp3quran.net/sds/' },
    { id: 'ajm', name: 'أحمد العجمي', url: 'https://server10.mp3quran.net/ajm/' },
    { id: 'maher', name: 'ماهر المعيقلي', url: 'https://server12.mp3quran.net/maher/' }
];

// قائمة أسماء السور (114 سورة)
const surahNames = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "المعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس"
];

// متغيرات حالة البوت
let currentSurahIndex = 1;
let currentReciter = reciters[0]; // الشغال افتراضياً: العفاسي
let volume = 1.0;
let connection = null;
const player = createAudioPlayer();
let currentResource = null;
let panelMessageData = { channelId: null, messageId: null };

// رابط السورة المباشر
function getSurahUrl(surahIndex, reciter) {
    const formattedIndex = String(surahIndex).padStart(3, '0');
    return `${reciter.url}${formattedIndex}.mp3`;
}

// تشغيل السورة
function playSurah(index) {
    currentSurahIndex = index;
    const url = getSurahUrl(currentSurahIndex, currentReciter);
    
    currentResource = createAudioResource(url, { inlineVolume: true });
    currentResource.volume.setVolume(volume);
    
    player.play(currentResource);
}

// بناء وتصميم البانل التفاعلي
function createPanelEmbed() {
    const embed = new EmbedBuilder()
        .setColor('#1f8b4c')
        .setTitle('📖 إذاعة القرآن الكريم - 24/7')
        .addFields(
            { name: '🎙️ القارئ الحالي', value: `**${currentReciter.name}**`, inline: true },
            { name: '📜 السورة الشغالة', value: `**سورة ${surahNames[currentSurahIndex - 1]}** (${currentSurahIndex}/114)`, inline: true },
            { name: '🔊 مستوى الصوت', value: `\`${Math.round(volume * 100)}%\``, inline: true }
        )
        .setFooter({ text: 'البوت يعمل باستمرار 24/7 بدون توقف' });

    // قائمة اختيار الشيوخ
    const reciterSelect = new StringSelectMenuBuilder()
        .setCustomId('select_reciter')
        .setPlaceholder('اختر الشيخ من هنا...')
        .addOptions(
            reciters.map(r => ({
                label: r.name,
                value: r.id,
                default: r.id === currentReciter.id
            }))
        );

    const rowReciter = new ActionRowBuilder().addComponents(reciterSelect);

    // أزرار التنقل والبحث
    const rowControls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_prev').setLabel('⏮️ السورة السابقة').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_search').setLabel('🔍 بحث عن سورة').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_next').setLabel('السورة التالية ⏭️').setStyle(ButtonStyle.Primary)
    );

    // أزرار التحكم بالصوت
    const rowVolume = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_vol_down').setLabel('🔉 توطية الصوت').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_vol_up').setLabel('🔊 تعلية الصوت').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [rowReciter, rowControls, rowVolume] };
}

// حلقة التكرار المستمرة 24/7 (عند انتهاء السورة)
player.on(AudioPlayerStatus.Idle, () => {
    currentSurahIndex = (currentSurahIndex % 114) + 1; // السورة التالية أوتوماتيك
    playSurah(currentSurahIndex);
    updatePanelMessage();
});

// تحديث رسالة البانل
async function updatePanelMessage() {
    if (!panelMessageData.channelId || !panelMessageData.messageId) return;
    try {
        const channel = await client.channels.fetch(panelMessageData.channelId);
        const msg = await channel.messages.fetch(panelMessageData.messageId);
        await msg.edit(createPanelEmbed());
    } catch (err) {
        console.log("خطأ في تحديث البانل:", err.message);
    }
}

// عند تشغيل البوت وتجهيز الأوامر
client.on('ready', async () => {
    console.log(`🤖 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);

    const setupCommand = new SlashCommandBuilder()
        .setName('setup-quran')
        .setDescription('تحديد الروم الصوتية وتثبيت بانل التحكم بالقرآن')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('اختر الروم الصوتية')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)
        );

    await client.application.commands.set([setupCommand]);
});

// التعامل مع جميع الأوامر والأزرار والبحث
client.on('interactionCreate', async (interaction) => {

    // 1. أمر Setup
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-quran') {
        const voiceChannel = interaction.options.getChannel('channel');
        await interaction.deferReply({ ephemeral: true });

        // مسح البانل القديمة لو كانت موجودة في روم تانية
        if (panelMessageData.channelId && panelMessageData.messageId) {
            try {
                const oldChannel = await client.channels.fetch(panelMessageData.channelId);
                const oldMsg = await oldChannel.messages.fetch(panelMessageData.messageId);
                await oldMsg.delete();
            } catch (e) { /* مسحوبة بالفعل أو مش موجودة */ }
        }

        // الانضمام للروم الصوتية
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        connection.subscribe(player);

        // إرسال البانل في شات الروم الصوتية
        const panelMsg = await voiceChannel.send(createPanelEmbed());
        panelMessageData = { channelId: voiceChannel.id, messageId: panelMsg.id };

        if (player.state.status !== AudioPlayerStatus.Playing) {
            playSurah(currentSurahIndex);
        }

        return interaction.editReply({ content: `✅ تم ربط البوت بـ **${voiceChannel.name}** وإرسال البانل بنجاح!` });
    }

    // 2. تغيير القارئ من القائمة
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_reciter') {
        await interaction.deferUpdate();
        const selectedId = interaction.values[0];
        const reciterObj = reciters.find(r => r.id === selectedId);

        if (reciterObj) {
            currentReciter = reciterObj;
            playSurah(currentSurahIndex);
            await updatePanelMessage();
        }
    }

    // 3. أزرار التحكم
    if (interaction.isButton()) {
        if (interaction.customId === 'btn_search') {
            const modal = new ModalBuilder()
                .setCustomId('search_modal')
                .setTitle('🔍 اختيار سورة معينة');

            const surahInput = new TextInputBuilder()
                .setCustomId('surah_input')
                .setLabel("اكتب اسم السورة أو رقمها (1-114)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("مثال: البقرة أو 2")
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(surahInput);
            modal.addComponents(row);
            return interaction.showModal(modal);
        }

        await interaction.deferUpdate();

        if (interaction.customId === 'btn_next') {
            currentSurahIndex = (currentSurahIndex % 114) + 1;
            playSurah(currentSurahIndex);
        } 
        else if (interaction.customId === 'btn_prev') {
            currentSurahIndex = currentSurahIndex <= 1 ? 114 : currentSurahIndex - 1;
            playSurah(currentSurahIndex);
        } 
        else if (interaction.customId === 'btn_vol_up') {
            volume = Math.min(volume + 0.1, 2.0);
            if (currentResource) currentResource.volume.setVolume(volume);
        } 
        else if (interaction.customId === 'btn_vol_down') {
            volume = Math.max(volume - 0.1, 0.0);
            if (currentResource) currentResource.volume.setVolume(volume);
        }

        await updatePanelMessage();
    }

    // 4. إدخال اسم السورة في نافذة البحث
    if (interaction.isModalSubmit() && interaction.customId === 'search_modal') {
        const query = interaction.fields.getTextInputValue('surah_input').trim();
        let foundIndex = -1;

        if (!isNaN(query)) {
            const num = parseInt(query);
            if (num >= 1 && num <= 114) foundIndex = num;
        } else {
            const index = surahNames.findIndex(s => s.includes(query) || query.includes(s));
            if (index !== -1) foundIndex = index + 1;
        }

        if (foundIndex !== -1) {
            playSurah(foundIndex);
            await updatePanelMessage();
            await interaction.reply({ content: `▶️ جاري تشغيل سورة **${surahNames[foundIndex - 1]}** بصوت **${currentReciter.name}**`, ephemeral: true });
        } else {
            await interaction.reply({ content: `❌ لم يتم العثور على سورة باسم أو رقم "${query}"`, ephemeral: true });
        }
    }
});

// قراءة التوكن من Variables على Railway
client.login(process.env.BOT_TOKEN);
  
