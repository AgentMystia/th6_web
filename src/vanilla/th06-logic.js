(function () {
  const TAU = Math.PI * 2;

  const SFX_BUFFER_IDX_VOLUME = [
    [0, -1500, 0], [0, -2000, 0], [1, -1200, 5], [1, -1400, 5],
    [2, -1000, 100], [3, -500, 100], [4, -500, 100], [5, -1700, 50],
    [6, -1700, 50], [7, -1700, 50], [8, -1000, 100], [9, -1000, 100],
    [10, -1900, 10], [11, -1200, 10], [12, -900, 100], [5, -1500, 50],
    [13, -900, 50], [14, -900, 50], [15, -600, 100], [16, -400, 100],
    [17, -1100, 0], [18, -900, 0], [5, -1800, 20], [6, -1800, 20],
    [7, -1800, 20], [19, -300, 50], [20, -600, 50], [21, -800, 50],
    [22, -100, 140], [23, -500, 100], [24, -1000, 20], [25, -1000, 90]
  ];

  const STAGE1_META = {
    stageNumber: 1,
    title: {
      primary: '第一关',
      original: 'STAGE 1',
      japanese: '梦幻夜行绘卷',
      english: '神秘飞行者'
    },
    presentation: {
      introFrames: 240,
      clearAfterFrame: 7600,
      itemBorderLine: { start: 58, end: 174 }
    },
    bossName: '露米娅',
    spells: [
      '月符「月光」',
      '夜符「夜雀」',
      '暗符「境界线」'
    ],
    music: ['stage1', 'boss1'],
    musicLabels: ['如鬼灯般的红色之魂', '妖魔夜行'],
    dialogueSource: 'https://thwiki.cc/游戏对话:东方红魔乡/博丽灵梦'
  };

  const STAGE2_META = {
    stageNumber: 2,
    title: {
      primary: '第二关',
      original: 'STAGE 2',
      japanese: '湖上的魔精',
      english: '水之魔术师'
    },
    presentation: {
      introFrames: 240,
      clearAfterFrame: 9000,
      itemBorderLine: { start: 58, end: 174 }
    },
    bossName: '琪露诺',
    midbossName: '大妖精',
    bossFaces: ['face05a', 'face05a'],
    spells: [
      '冰符「冰柱坠落」',
      '雹符「冰雹暴风」',
      '冻符「完美冻结」',
      '雪符「钻石风暴」'
    ],
    music: ['stage2', 'boss2'],
    musicLabels: ['露奈特精灵', '活泼的纯情小姑娘'],
    dialogueSource: 'https://thwiki.cc/游戏对话:东方红魔乡/博丽灵梦'
  };

  const STAGE3_META = {
    stageNumber: 3,
    title: {
      primary: '第三关',
      original: 'STAGE 3',
      japanese: '红色之境',
      english: 'Scarlet Land'
    },
    presentation: {
      introFrames: 240,
      clearAfterFrame: 5920,
      itemBorderLine: { start: 58, end: 174 }
    },
    bossName: '红美铃',
    midbossName: '红美铃',
    bossFaces: ['face06a', 'face06a', 'face06b', 'face06b'],
    spells: [
      '华符「芳华绚烂」',
      '华符「Selaginella 9」',
      '虹符「彩虹的风铃」',
      '幻符「华想梦葛」',
      '彩符「彩雨」',
      '彩符「彩光乱舞」',
      '彩符「极彩台风」'
    ],
    music: ['stage3', 'boss3'],
    musicLabels: ['上海红茶馆 ～ Chinese Tea', '明治十七年的上海爱丽丝'],
    dialogueSource: 'https://thwiki.cc/游戏对话:东方红魔乡/博丽灵梦/中日对照'
  };

  const STAGE4_META = {
    stageNumber: 4,
    title: {
      primary: '第四关',
      original: 'STAGE 4',
      japanese: '漆黑之馆',
      english: 'Save the mind.'
    },
    presentation: {
      introFrames: 240,
      clearAfterFrame: 10700,
      itemBorderLine: { start: 58, end: 174 }
    },
    bossName: '帕秋莉·诺蕾姬',
    midbossName: '小恶魔',
    bossFaces: ['face08a', 'face08a', 'face08b', 'face08b'],
    spells: [
      '火符「Agni Shine」',
      '水符「Princess Undine」',
      '木符「Sylphy Horn」',
      '土符「Lazy Trilithon」',
      '金符「Metal Fatigue」',
      '火符「Agni Shine 上级」',
      '木符「Sylphy Horn 上级」',
      '土符「Lazy Trilithon 上级」',
      '火符「Agni Radiance」',
      '水符「Bury In Lake」',
      '木符「Green Storm」',
      '土符「Trilithon Shake」',
      '金符「Silver Dragon」',
      '火&土符「Lava Cromlech」',
      '木&火符「Forest Blaze」',
      '水&木符「Water Elf」',
      '金&水符「Mercury Poison」',
      '土&金符「Emerald Megalith」'
    ],
    music: ['stage4', 'boss4'],
    musicLabels: ['伏瓦鲁魔法图书馆', 'Locked Girl ～ 少女密室'],
    dialogueSource: 'https://thwiki.cc/游戏对话:东方红魔乡/博丽灵梦/中日对照'
  };

  const STAGE5_META = {
    stageNumber: 5,
    title: {
      primary: '第五关',
      original: 'STAGE 5',
      japanese: '红月下潇洒的从者',
      english: 'Maid and Pocket Watch of Blood'
    },
    presentation: {
      introFrames: 240,
      clearAfterFrame: 7710,
      itemBorderLine: { start: 58, end: 174 }
    },
    bossName: '十六夜咲夜',
    midbossName: '十六夜咲夜',
    bossFaces: ['face09a', 'face09a', 'face09b', 'face09b'],
    spells: [
      '奇术「Misdirection」',
      '奇术「幻惑 Misdirection」',
      '幻在「Clock Corpse」',
      '幻象「Luna Clock」',
      '女仆秘技「操弄玩偶」',
      '幻幽「Jack the Ludo Bile」',
      '幻世「The World」',
      '女仆秘技「杀人玩偶」'
    ],
    music: ['stage5', 'boss5'],
    musicLabels: ['女仆与血之怀表', '月时计 ～ Luna Dial'],
    dialogueSource: 'https://thwiki.cc/游戏对话:东方红魔乡/博丽灵梦/中日对照'
  };

  const STAGE6_META = {
    stageNumber: 6,
    title: {
      primary: '最终关',
      original: 'FINAL STAGE',
      japanese: '乐园洒下血雨',
      english: 'Scarlet Gensokyo'
    },
    presentation: {
      introFrames: 240,
      clearAfterFrame: 3180,
      itemBorderLine: { start: 58, end: 174 }
    },
    bossName: '蕾米莉亚·斯卡蕾特',
    midbossName: '十六夜咲夜',
    bossFaces: ['face10a', 'face10a', 'face10b', 'face10b'],
    midbossFaces: ['face09a', 'face09a', 'face09b', 'face09b'],
    spells: [
      '奇术「Eternal Meek」',
      '天罚「Star of David」',
      '冥符「红色的冥界」',
      '诅咒「Vlad Tepes的诅咒」',
      '红符「Scarlet Shoot」',
      '「Red Magic」',
      '神罚「幼小的恶魔之王」',
      '狱符「千根针的针山」',
      '神术「吸血鬼幻想」',
      '红符「Scarlet Meister」',
      '「红色的幻想乡」'
    ],
    music: ['stage6', 'boss6'],
    musicLabels: ['特佩斯的年幼末裔', '献给已逝公主的七重奏'],
    dialogueSource: 'https://thwiki.cc/游戏对话:东方红魔乡/博丽灵梦/中日对照'
  };

  const STAGE_META = {
    1: STAGE1_META,
    2: STAGE2_META,
    3: STAGE3_META,
    4: STAGE4_META,
    5: STAGE5_META,
    6: STAGE6_META
  };

  const SPELL_NAMES = [
    ...STAGE1_META.spells,
    ...STAGE2_META.spells,
    ...STAGE3_META.spells,
    ...STAGE4_META.spells,
    ...STAGE5_META.spells,
    ...STAGE6_META.spells
  ];

  const DIFFICULTY_INFO = {
    easy: { rank: 16, minRank: 12, maxRank: 20 },
    normal: { rank: 16, minRank: 10, maxRank: 32 },
    hard: { rank: 16, minRank: 10, maxRank: 32 },
    lunatic: { rank: 16, minRank: 10, maxRank: 32 },
    extra: { rank: 16, minRank: 14, maxRank: 18 }
  };

  const POWER_UP_THRESHOLDS = [8, 16, 32, 48, 64, 80, 96, 128, 999, 1, 0];
  const EXTRA_LIFE_SCORES = [10000000, 20000000, 40000000, 60000000, 1900000000];
  const MAX_SCORE = 999999999;
  const MAX_LIVES = 8;
  const ENEMY_BULLET_CAP = 640;
  const POWER_ITEM_SCORE = [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700,
    800, 900, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
    11000, 12000, 51200
  ];
  const SPELLCARD_SCORE = [
    200000, 200000, 200000, 200000, 200000, 200000, 200000, 250000, 250000, 250000, 250000, 250000, 250000,
    250000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 300000,
    300000, 300000, 300000, 300000, 300000, 300000, 400000, 400000, 400000, 400000, 400000, 400000, 400000,
    400000, 500000, 500000, 500000, 500000, 500000, 500000, 600000, 600000, 600000, 600000, 600000, 700000,
    700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000, 700000
  ];
  const POINT_SCORE_TABLE = {
    easy: { top: 100000, bottom: 60000, multiplier: 100 },
    normal: { top: 100000, bottom: 60000, multiplier: 100 },
    hard: { top: 150000, bottom: 100000, multiplier: 180 },
    lunatic: { top: 200000, bottom: 150000, multiplier: 270 },
    extra: { top: 300000, bottom: 200000, multiplier: 400 }
  };

  const EFFECT_COLORS_WITH_TEXTURE = [
    0xff000000, 0xff303030, 0xff606060, 0xff500000, 0xff900000, 0xffff2020, 0xff400040,
    0xff800080, 0xffff30ff, 0xff000050, 0xff000090, 0xff2020ff, 0xff203060, 0xff304090,
    0xff3080ff, 0xff005000, 0xff009000, 0xff20ff20, 0xff206000, 0xff409010, 0xff80ff20,
    0xff505000, 0xff909000, 0xffffff20, 0xff603000, 0xff904010, 0xfff08020, 0xffffffff
  ];

  const PLAYER_SYSTEM = {
    hitboxHalf: { x: 1.25, y: 1.25, z: 5 },
    grazePadding: 20,
    itemGrabHalf: { x: 12, y: 12, z: 5 },
    movementArea: { x: 8, y: 16, width: 368, height: 416 },
    speeds: {
      reimu: { normal: 4, focus: 2 },
      marisa: { normal: 5, focus: 2.5 }
    }
  };

  const BULLET_TYPE_NAMES = [
    'pellet', 'ringBall', 'rice', 'ball', 'kunai',
    'shard', 'bigBall', 'fireball', 'dagger', 'bubble'
  ];

  function bulletGrazeSize(spriteType, height) {
    if (height <= 8) return { x: 4, y: 4 };
    if (height <= 16) {
      if (spriteType === 2 || spriteType === 5) return { x: 4, y: 4 };
      if (spriteType === 4) return { x: 5, y: 5 };
      return { x: 6, y: 6 };
    }
    if (height <= 32) {
      if (spriteType === 7) return { x: 11, y: 11 };
      if (spriteType === 8) return { x: 9, y: 9 };
      return { x: 16, y: 16 };
    }
    return { x: 32, y: 32 };
  }

  const DIALOGUE_ZH_CN = new Map(Object.entries({
    '久々のお仕事だわ。': '久违的工作啊。',
    '気持ちいいわね': '真舒服呢',
    '毎回、昼間に出発して悪霊が少ない': '每次都在白天出发，恶灵比较少',
    'から、夜に出てみたんだけど...': '所以这次试着晚上出来了...',
    'どこに行っていいかわからないわ': '可是完全不知道该往哪里走呢',
    '暗くて': '黑漆漆的',
    'でも...': '不过...',
    '夜の境内裏はロマンティックね': '夜晚的神社后院很浪漫呢',
    '（←のんき）': '（←悠闲）',
    'そうなのよね～': '是这样呢～',
    'お化けも出るし、たまんないわ': '还会有妖怪出现，真受不了啊',
    'って、': '话说，',
    'あんた誰？': '你是谁？',
    '宵闇の妖怪': '宵暗的妖怪',
    'ルーミア': '露米娅',
    'さっき会ったじゃない': '刚才不是见过了吗',
    'あんた、もしかして鳥目？': '你该不会是夜盲吧？',
    '人は暗いところでは物が': '人类在黑暗的地方',
    '良く見えないのよ': '看不清东西啊',
    'あら？夜しか活動しない人も': '哎呀？我好像也见过',
    '見たことある気がするわ': '只在夜里活动的人呢',
    'それは取って食べたりしても': '那种可以抓来吃掉',
    'いいのよ': '也没关系哦',
    'そーなのかー': '是这样吗～',
    'で、邪魔なんですけど': '所以说，你很碍事',
    '目の前が取って食べれる人類？': '眼前这个是可以抓来吃的人类？',
    '良薬は口に苦し': '你知道“良药苦口”',
    'って言葉知ってる？': '这句话吗？',
    '良薬っていっても': '虽说是良药',
    '飲んでみなけりゃわかんないけどね': '不喝下去也不会知道呢',
    'こういう気持ち、なんというか･･･': '这种感觉，该怎么说呢……',
    'あいつだったら「気持ちいいわね」': '要是那家伙的话，大概会说“真舒服呢”',
    'とかいいそうだな': '之类的话吧',
    'わたしは夜は嫌いだけどな': '不过我讨厌夜晚',
    '変な奴しかいないし': '净是些奇怪的家伙',
    '変な奴って誰のことよ': '你说奇怪的家伙是谁啊',
    '誰もあんたのことって言ってないぜ': '我可没说是在说你',
    'それはまぁ、当然': '那倒也是，当然啦',
    'で、何でそんな手広げてるのさ': '所以，你为什么把手张那么开？',
    '「聖者は十字架に磔られました」': '看起来像是在说“圣者被钉在十字架上了”吗？',
    'っていってるように見える？': '看起来像这样吗？',
    '「人類は十進法を採用しました」': '看起来像是在说“人类采用了十进制”',
    'って見えるな': '倒是更像这个',
    '人類以外は': '人类以外的生物',
    '指は十本じゃないのかしら': '手指难道不是十根吗？',
    'この湖こんなに広かったかしら？': '这湖有这么宽吗？',
    '霧で見通しが悪くて困ったわ。': '雾太大看不清，真麻烦。',
    'もしかして私って方向音痴？': '难道说我是路痴？',
    '道に迷うは、妖精の所為なの': '迷路都是妖精的错哦',
    '湖上の氷精': '湖上的冰精',
    'チルノ': '琪露诺',
    'あらそう？、じゃ、案内して？': '是吗？那你来带路吧？',
    'ここら辺に島があったでしょ？': '这附近应该有座岛吧？',
    'あんた、ちったぁ驚きなさいよ': '你多少给我惊讶一下啊',
    '目の前に強敵がいるのよ？': '强敌可就在你眼前哦？',
    '標的？': '目标？',
    'こいつはびっくりだぁね': '这可真叫人吃惊呢',
    'ふざけやがって～': '你竟敢耍我～',
    'あんたなんて、英吉利牛と一緒に': '像你这种家伙，就和英国牛一起',
    '冷凍保存してやるわ！！': '冷冻保存起来吧！！',
    'ああ、冷えてきたわ': '啊，开始冷起来了',
    '冷房病になっちゃうわ': '要得空调病了',
    '島は確かこの辺だったような気が': '岛应该就在这一带吧',
    'するが・・・': '我记得是这样……',
    'もしかして移動してるのか？': '难道它在移动吗？',
    'それにしても・・・': '话说回来……',
    'おおよそ夏だぜ': '现在差不多是夏天吧',
    'なんでこんなに冷えるんだ？': '为什么会这么冷？',
    'もう二度と陸には上がらせないよ！': '我不会再让你上岸了！',
    'あんたね。寒いのは': '我说你啊，冷一点',
    '暑いよりはいいでしょ？': '总比热得要命好吧？',
    '寒い奴': '冷场的家伙',
    'それはなにか違う・・・': '这说法好像不太对……',
    'いっぱいいっぱいなんだろ？': '你已经忙不过来了吧？',
    'ああ、半袖じゃ体に悪いわ': '啊，穿短袖这样下去会伤身体',
    '早く、お茶でも出してくれるお屋敷': '快去找个会端茶出来的洋馆',
    '探そう、っと': '找找看吧'
  }));

  for (const [source, zh] of Object.entries({
    'ついてくるなよ～': '不要跟过来啊～',
    '道案内ありがと～': '感谢带路～',
    'あら、私について来ても': '啊啦，就算你跟着我过来',
    'こっちには何もなくてよ？': '这边也是什么都没有的啊？',
    '華人小娘': '华人小姑娘',
    '紅 美鈴': '红美铃',
    '何もないところに逃げないでしょ？': '你是不会往什么都没有的地方逃的吧？',
    'うーん、逃げるときは逃げる': '嗯，逃的时候就只想着',
    'と思うけどなぁ': '逃的事情了',
    'ちなみに、あなた、何者？': '顺便问下，你是什么人？',
    'えー、普通の人よ': '哎，普通人哟',
    'さっき攻撃仕掛けてきたでしょ？': '刚才是你对我动手的吧？',
    'それは、普通に攻撃したの': '那个是普通的攻击而已',
    'でも、あんたが先に攻撃したのよ': '但是，是你先攻击的啊',
    'あんたが、普通以外なのよ': '你是普通之外的说',
    '私は巫女をしている普通の人よ': '我只是个当巫女的普通人来着啊',
    'それはよかった': '那可真是太好了',
    'たしか．．．': '确实有……',
    '巫女は食べてもいい人類だって': '巫女是吃了也没问题的人类',
    '言い伝えが．．．': '之类的传说呢……',
    '言い伝えるな！': '不要传谣了！',
    'さぁて、道案内してもらいますよ': '那么，领路就拜托你了哦',
    '済みません、お嬢様～': '对不起，大小姐～',
    'くそ、背水の陣だ！': '可恶，背水阵！',
    'あんた一人で「陣」なのか？': '你一个人也算是「阵」吗？',
    'あ、さっきはどうも': '啊，刚才承蒙关照。',
    'お久しぶりですわ': '好久不见了呢。',
    'って、私たちいつから知り合いに': '咦？我们什么时候开始成了',
    'なったのよ～': '熟人？',
    'さっきだろ？': '就在刚才吧？',
    'うーん、変な奴と会っちゃった': '呜，遇到奇怪的人了啊',
    'なぁ': '呢',
    'いいから邪魔だよ': '好了，不要碍事了',
    'ここの番人なんだろ？': '你就是这里看门的吧？',
    '番人だから、邪魔するのよ': '正因为是门卫才要碍你的事啊',
    'やっぱ、あんた、番人なのか？': '果然，你是看门的吧？',
    '番人してるだけの普通の人よ': '只是个做门卫的普通人哦。',
    'つまり、普通の人ね': '也就是说，普通人呢',
    'ここで成敗してくれるわ': '那就让我给你点惩罚吧～',
    'あんた、どういう教育を受けたのよ': '你这家伙，究竟受的什么教育啊～',
    'やっぱり普通の人と戦うのは、': '果然，和普通人战斗，',
    '私の性にあわないわ': '不符合我的性格呢。',
    '絶対うそだ～': '绝对是骗人～',
    'くそ、とりあえず逃げるぞ！': '可恶，先逃跑再说！',
    '逃すぜ': '让她逃了诶',

    'この家には窓が無いのかしら？': '这家人屋里都不安窗户的吗？',
    'それに外から見たとき': '而且从外面看的时候',
    'こんなに広かったっけ？': '感觉有这么大吗？',
    'そこの紅白！': '那边的红白！',
    '私の書斎で暴れない': '不准在我的书房里捣乱',
    '書斎？（紅白？）': '书房？（红白？）',
    'これらの本はあなたの神社の': '这里的书价值能比得上你家神社',
    '５年分の賽銭程度の価値があるわ': '五年份的赛钱呢',
    '知識と日陰の少女': '知识与避世的少女',
    'パチュリー・ノーレッジ': '帕秋莉·诺蕾姬',
    'うちは年中無休で参拝客が無いわよ': '我那里就算全年无休也一个参拜客也没有哦',
    'まぁその程度の価値しか無いんだよ': '嘛你的神社也就只有那种程度的价值了',
    'それにしてもこんな暗い部屋で': '说起来在这么暗的屋子里',
    '本なんか読めるのか？': '能读书吗？',
    '私はあなたみたいに鳥目': '我可不是像你一样的夜盲症',
    'じゃないわ': '患者',
    'だから～、私は鳥目じゃない': '所以说～我才不是夜盲症',
    'って': '什么的',
    'って、そうじゃなくて、': '切，才不是想说这个呢，',
    'あなたが、ここのご主人？': '你就是这里的主人吗？',
    'お嬢様になんの用？': '你找大小姐有什么事？',
    '霧の出しすぎで、困る': '放出的雾太多了，很令人困扰啊',
    'じゃぁ、お嬢様には絶対会わせ': '那么，就绝对不可以让你',
    'ないわ': '去见大小姐了',
    '邪魔させないわ': '不许碍事',
    '・・・ところで、あんた、誰？': '……话说回来，你是谁？',
    'それにしてもこの館って、外から': '说起来这个馆，从外面看',
    '見て、こんなに広かったっけ？': '有这么宽敞么？',
    '家には空間をいじるのが好きな人が': '家里有个喜欢摆弄空间的人',
    'いるのよ': '在哦',
    'わぁ、本がいっぱいだぁ': '哇，书好多啊',
    '後で、さっくり貰っていこ': '等会儿顺手拿几本走吧',
    '持ってかないでー': '不要拿走—',
    '持ってくぜ': '我就要拿走',
    'えぇーと、目の前の黒いのを': '呃，把眼前这个黑乎乎的东西',
    '消極的にやっつけるには・・・': '消极地解决掉的方法是……',
    '（載ってるのか？）': '（书上会写这个吗？）',
    'うーん、最近、目が悪くなったわ': '嗯，最近视力变差了',
    '部屋が暗いんじゃないのか？': '不是房间太暗了吗？',
    '鉄分が足りないのかしら': '难道是铁元素不足吗',
    'どっちかっつーとビタミンＡだな': '要说的话更像是维生素A吧',
    'あなたは？': '你呢？',
    '足りてるぜ、色々とな': '我可充足得很，各种意义上',
    'じゃぁ、頂こうかしら': '那么，我就收下吧',
    '私は美味しいぜ': '我很好吃哦',
    'えぇーと、簡単に素材のアクを': '呃，简单去除食材涩味的',
    '取り除く調理法は・・・': '烹调方法是……',
    '魔法が得意のようだな': '看来你很擅长魔法啊',
    'まだ、隠しもってんじゃないのか？': '还有什么藏着没拿出来吧？',
    'しくしく、貧血でスペルが': '呜呜，因为贫血',
    '唱え切れないの': '咒语都念不完了',

    'また、お掃除の邪魔する～': '又来妨碍我打扫～',
    'あなたー': '你啊—',
    'は、ここの主人じゃなさそうね': '看起来不像是这里的主人呢',
    'なんなの？': '你是什么人？',
    'お嬢様のお客様？': '大小姐的客人？',
    '紅魔館のメイド': '红魔馆的女仆',
    '十六夜 咲夜': '十六夜咲夜',
    '（倒しに来たってっても通してくれ': '（就算说是来打倒她的也不会',
    'ないよな）': '放我过去吧）',
    '通さないよ': '不会放你过去的',
    'お嬢様は滅多に人に会うような': '大小姐很少会见别人',
    'ことはないわ': '的哦',
    '軟禁されてるの？': '被软禁了吗？',
    'お嬢様は暗いところが好きなのよ': '大小姐喜欢阴暗的地方',
    '暗くないあなたでもいいわ': '不阴暗的你也可以哦',
    'ここら辺一帯に霧を出してるの': '在这一带放出雾气的',
    'あなた達でしょ？': '就是你们吧？',
    'あれが迷惑なの': '那个很麻烦',
    '何が目的なの？': '目的是什么？',
    '日光が邪魔だからよ': '因为阳光很碍事',
    'お嬢様、冥い好きだし': '大小姐也喜欢阴暗',
    '私は好きじゃないわ': '我可不喜欢',
    '止めてくれる？': '能停下来吗？',
    'それはお嬢様に言ってよ': '那就去跟大小姐说吧',
    'じゃ呼んできて': '那就把她叫来',
    'って、ご主人様を危険な目に': '喂，怎么可能让主人',
    '遭わせる訳無いでしょ？': '遭遇危险呢？',
    'ここで騒ぎを起こせば出て': '如果我在这里闹起来',
    'くるかしら？': '她会出来吗？',
    'もう十分騒がしいわ': '已经够吵了',
    'でも、あなたはお嬢様には': '不过，你是见不到',
    '会えない': '大小姐的',
    'それこそ、時間を止めてでも': '哪怕停止时间',
    '時間稼ぎが出来るから': '我也能拖住你',
    'さぁ、会わせてくれるかしら': '那么，可以让我见她了吗',
    '強い・・・': '好强……',
    'でも、お嬢様ならあるいは': '但是大小姐的话或许……',
    'あー、お掃除が進まない！': '啊—打扫完全没进展！',
    'お嬢様に怒られるじゃない！！': '会被大小姐责备的！！',
    'さぁ、どおだ！': '来吧，怎么样！',
    'その程度で、なにいきがってんのよ': '就这点程度，有什么好得意的',
    'まだまだだわ': '还差得远呢',
    '２時間前に出直してきな': '两小时前再来吧',
    'いやはやメイドとは': '哎呀，女仆这种东西',
    '捕まえるとワシントン条約に': '抓起来会违反',
    '引っかかるな': '华盛顿条约呢',
    'ああ、魔法使いは生類哀れみの令': '啊啊，魔法使可是受生类怜悯令',
    'だあね': '保护呢',
    '哀れんでぇ': '可怜可怜我呀',
    'で？': '所以呢？',
    'あなたもこの館に雇われたの': '难道你也被这个洋馆',
    'かしら？': '雇佣了吗？',
    'ああ、そうでもいいな': '啊啊，那好像也不错呢',
    'でも、あんたじゃ掃除も出来そう': '不过，你看起来也不像',
    'に無いわね': '会打扫卫生的样子呢',
    '出来ないぜ': '不会呢',
    'じゃぁ、何係？': '那你是负责什么的？',
    '恋愛係？': '负责恋爱的？',
    'むしろ営繕係だな': '不如说是负责修缮的',
    '何だよそれ': '那是什么啊',
    '小学校でもあるまいし': '又不是在小学里',
    '恋愛係は中等部なのか？': '负责恋爱就属于初中了吗',
    'さて、早速仕事に取りかかって': '好了，还是赶快让我',
    '貰おうかしら': '着手工作吧',
    '言い忘れたけど私は、ここの': '忘了说了，我呢，是这里的',
    'メイド長の咲夜。': '女仆长——咲夜。',
    'ってことは、私があなたを倒せば': '也就是说，我要是打倒你的话',
    'メイド長ってことね': '就能成为女仆长了呢',
    'そういって返り討ちに会った人は': '嘴上那么说最后惨败的人',
    'トリウム崩壊系列の数より多いわ': '比钍衰变链的数目还要多呢',
    'あ、結構普通なんだな': '啊，相当正常嘛',
    'そういうことって': '那种事情',
    'あなたの時間も私のもの・・・': '你的时间也是属于我的……',
    '古風な魔女に勝ち目は、ない': '古旧魔女胜利的希望，是零。',
    'メイドじゃなくても、メイド長に': '就算不是女仆，是不是也能',
    'なれるのか？': '当女仆长啊？',
    'なれるわけ無いじゃない': '当然不可能～',
    'あー、疲れた': '啊—累了',
    'そろそろ帰ったら？': '差不多该回去了吧？',
    '私も仕事あるし': '我也还有工作',
    'そうします': '那我就回去吧',
    'そう？': '是吗？',
    'じゃ': '那么',

    'そろそろ姿、見せてもいいん': '差不多也该现身了吧',
    'じゃない？': '不是吗？',
    'お嬢さん？': '大小姐？',
    'やっぱり、人間って使えないわね': '果然，人类真没用呢',
    '永遠の紅い幼き月': '永远鲜红的幼月',
    'レミリア・スカーレット': '蕾米莉亚·斯卡蕾特',
    'さっきのメイドは人間だったのか': '刚才那个女仆原来是人类吗',
    'あなた、殺人犯ね': '你是杀人犯呢',
    '一人までなら大量殺人犯じゃない': '只杀一个人的话还不算大量杀人犯',
    'から大丈夫よ': '所以没关系哦',
    'そうそう、迷惑なの': '对对，很麻烦',
    'あんたが': '说的就是你',
    '短絡ね。しかも理由が分からない': '真短路呢。而且完全不明白理由',
    'とにかく、ここから出ていって': '总之，可以从这里出去',
    'くれる？': '吗？',
    'ここは、私の城よ？': '这里可是我的城堡哦？',
    '出ていくのはあなただわ。': '该出去的是你。',
    'この世から出てってほしいのよ': '我是希望你从这个世界出去',
    'しょうがないわね': '真拿你没办法',
    '今、お腹いっぱいだけど・・・': '虽然我现在已经吃饱了……',
    '護衛にあのメイドを': '当护卫的那个女仆',
    '雇っていたんでしょ？': '是你雇来的对吧？',
    'そんな、箱入りお嬢様なんて': '像你这样的深闺大小姐',
    '一撃よ！': '一招就能打倒！',
    '咲夜は優秀な掃除係': '咲夜是个优秀的扫除者',
    'おかげで、首一つ落ちてないわ': '托她的福，这里一颗头都没掉过哦',
    'あなたはつよいの？': '你难道很强么？',
    'さあね。': '谁知道呢。',
    'あんまり外に出して貰えないの': '我又不怎么到外面去',
    '私が日光に弱いから': '因为我对阳光很没辙',
    '・・・': '……',
    'なかなか出来るわね': '似乎很有一手的样子呢',
    'こんなに月も紅いから': '在如此鲜红的月亮之下',
    '本気で殺すわよ': '我真的会杀掉你哦',
    'こんなに月も紅いのに': '既然月亮如此鲜红',
    '楽しい夜になりそうね': '看来会成为欢愉之夜呢',
    '永い夜になりそうね': '看来会成为永远之夜呢',
    'お嬢様の怒られる前に': '在被大小姐责备之前',
    'せめて１ボムでも潰させないと～': '至少也得让你用掉一颗Bomb～',
    '黙って、お使いにでも出たら？': '闭嘴，去跑个腿不就好了？',
    'いるいる': '在呢在呢',
    '悪寒が走るわ、この妖気': '这妖气让我背脊发凉',
    '何で強力な奴ほど隠れるんだ？': '为什么越强的家伙越喜欢躲着？',
    '能ある鷹は尻尾隠さず...': '有能的鹰不会藏起尾巴……',
    'よ': '哦',
    '...脳なさそうだな': '……你看起来没什么脑子啊',
    '人間だけよ': '只有人类才需要',
    '脳なんて単純で化学的な': '大脑那种单纯又化学性的',
    '思考中枢が必要なのは': '思考中枢',
    'おまえ、アレだろ？': '你就是那个吧？',
    'ほら日光とか臭い野菜とか': '就是怕日光、臭蔬菜',
    '銀のアレとか': '还有银制的那个什么',
    '夜の支配者なのに': '明明是夜之支配者',
    'なぜか弱点の多いという...': '却不知为何弱点很多的……',
    'そうよ、病弱っ娘なのよ': '没错，是病弱少女哦',
    '面白そうだな、やっぱ飲むのか？': '听起来挺有趣，果然会喝吗？',
    'アレ': '那个',
    '当たり前じゃない': '那不是理所当然的吗',
    '私は小食でいつも残すけどね': '不过我饭量小，总会剩下呢',
    '今まで何人の血を吸ってきた？': '你至今吸过多少人的血？',
    'あなたは今まで食べてきたパンの': '你还记得至今为止吃过的',
    '枚数を覚えてるの？': '面包片数吗？',
    '１３枚': '十三片',
    '私は和食ですわ': '我是吃日式饭菜的',
    'で、何しに来たの？': '所以，你来做什么？',
    'もう、私お腹いっぱいだけど・・': '我已经吃饱了呢……',
    'そうだな、私はお腹がすいたぜ': '是啊，我倒是肚子饿了',
    '・・・食べても、いいのよ': '……吃掉，也可以哦',
    'ああ、そうかい': '啊，是吗',
    '今の、植物の名前だぜ': '刚才那个，是植物的名字',
    '「亜阿相界」': '「亜阿相界」',
    '人間って楽しいわね': '人类真有趣呢',
    'それともあなたは人間じゃ': '还是说，你根本就不是',
    'ないのかしら？': '人类呢？',
    '楽しい人間だぜ': '是快乐的人类哦',
    'ふふふ、こんなに月も紅いから？': '呵呵呵，因为月亮也如此之红吗？',
    '暑い夜になりそうね': '似乎会是酷暑之夜呢',
    '涼しい夜になりそうだな': '似乎会是凉爽之夜呢',
    'あなたみたいな人も珍しいわね': '像你这样的人也真少见呢',
    'こっちには何もないわよ？': '这边可什么都没有哦？',
    'おまえもな': '你也一样吧',
    'ほんとにメイドなのか？': '你真的是女仆吗？'
  })) DIALOGUE_ZH_CN.set(source, zh);

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function truncDiv(n, d) {
    return Math.trunc(n / d);
  }

  function rankInfo(difficulty = 'lunatic') {
    const info = DIFFICULTY_INFO[difficulty];
    if (!info) throw new Error(`Unknown TH06 difficulty: ${difficulty}`);
    return info;
  }

  function adjustRankState(rank, subRank, amount, difficulty = 'lunatic') {
    const info = rankInfo(difficulty);
    let nextRank = rank | 0;
    let nextSubRank = (subRank | 0) + (amount | 0);
    while (nextSubRank >= 100) {
      nextRank++;
      nextSubRank -= 100;
    }
    while (nextSubRank < 0) {
      nextRank--;
      nextSubRank += 100;
    }
    nextRank = clamp(nextRank, info.minRank, info.maxRank);
    return { rank: nextRank, subRank: nextSubRank };
  }

  function powerThresholdIndex(power) {
    let idx = 0;
    while (power >= POWER_UP_THRESHOLDS[idx]) idx++;
    return idx;
  }

  function collectPowerItem(power, powerItemCountForScore, amount) {
    let nextPower = clamp(power | 0, 0, 128);
    let nextPowerScoreCount = clamp(powerItemCountForScore | 0, 0, 30);
    if (nextPower >= 128) {
      nextPowerScoreCount = clamp(nextPowerScoreCount + amount, 0, 30);
      return {
        power: 128,
        powerItemCountForScore: nextPowerScoreCount,
        score: POWER_ITEM_SCORE[nextPowerScoreCount],
        powerUp: false,
        fullPower: false
      };
    }
    const beforeIdx = powerThresholdIndex(nextPower);
    nextPowerScoreCount = 0;
    nextPower = clamp(nextPower + amount, 0, 128);
    const fullPower = nextPower >= 128;
    const afterIdx = powerThresholdIndex(nextPower);
    return {
      power: nextPower,
      powerItemCountForScore: nextPowerScoreCount,
      score: 10,
      powerUp: afterIdx !== beforeIdx,
      fullPower
    };
  }

  function pointItemScore(y, difficulty = 'lunatic') {
    const table = POINT_SCORE_TABLE[difficulty];
    if (!table) throw new Error(`Unknown TH06 point item score difficulty: ${difficulty}`);
    const yy = Math.trunc(y);
    return yy < 128 ? table.top : table.bottom - ((yy - 128) * table.multiplier);
  }

  function pointBulletScore(graze, bombActive = false) {
    return bombActive ? 100 : Math.trunc(graze / 3) * 10 + 500;
  }

  function missPowerDrops(livesRemaining) {
    if ((livesRemaining | 0) > 0) return ['bigPower', 'power', 'power', 'power', 'power', 'power'];
    return ['fullPower', 'fullPower', 'fullPower', 'fullPower', 'fullPower'];
  }

  function spellcardBonus(spellId, secondsRemaining) {
    const base = SPELLCARD_SCORE[((spellId | 0) % SPELLCARD_SCORE.length + SPELLCARD_SCORE.length) % SPELLCARD_SCORE.length];
    return base + Math.trunc(base * Math.max(0, secondsRemaining | 0) / 10);
  }

  function stageClearBonus({ stageNumber, power, graze, pointItems, difficulty, lives = 0, bombs = 0 }) {
    let score = ((stageNumber | 0) * 1000) + ((graze | 0) * 10) + ((power | 0) * 100);
    score *= Math.max(0, pointItems | 0);
    if ((stageNumber | 0) >= 6) score += (lives | 0) * 3000000 + (bombs | 0) * 1000000;
    if (difficulty === 'easy') score = Math.trunc(score / 2);
    else if (difficulty === 'hard') score = Math.trunc(score * 12 / 10);
    else if (difficulty === 'lunatic') score = Math.trunc(score * 15 / 10);
    else if (difficulty === 'extra') score *= 2;
    return score - score % 10;
  }

  function shootIntervalForRank(baseInterval, rank) {
    const base = baseInterval | 0;
    const low = truncDiv(base, 5);
    const high = truncDiv(-base, 5);
    return Math.max(0, base + truncDiv((rank | 0) * (high - low), 32) + low);
  }

  function effectColorCss(color) {
    const value = color >>> 0;
    const a = ((value >>> 24) & 0xff) / 255;
    const r = (value >>> 16) & 0xff;
    const g = (value >>> 8) & 0xff;
    const b = value & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  function effectColorById(id) {
    return EFFECT_COLORS_WITH_TEXTURE[((id % EFFECT_COLORS_WITH_TEXTURE.length) + EFFECT_COLORS_WITH_TEXTURE.length) % EFFECT_COLORS_WITH_TEXTURE.length];
  }

  function localizeDialogueText(text) {
    if (!text) return text || '';
    const trimmed = text.trim();
    const translated = DIALOGUE_ZH_CN.get(trimmed);
    return translated || text;
  }

  function steerVelocity(x, y, vx, vy, speed, target, divisor) {
    const dx = target.x - x;
    const dy = target.y - y;
    let len = Math.hypot(dx, dy) / Math.max(0.0001, speed / divisor);
    if (len < 1) len = 1;
    const sx = dx / len + vx;
    const sy = dy / len + vy;
    let nextSpeed = Math.hypot(sx, sy);
    if (nextSpeed <= 0.0001) return { vx, vy, speed };
    nextSpeed = clamp(nextSpeed, 1, 10);
    return {
      vx: sx * nextSpeed / Math.hypot(sx, sy),
      vy: sy * nextSpeed / Math.hypot(sx, sy),
      speed: nextSpeed
    };
  }

  function updateHomingBullet(bullet, target) {
    bullet.homingFrame = bullet.homingFrame || 0;
    bullet.speed = bullet.speed || Math.hypot(bullet.vx, bullet.vy) || 1;
    if (target && target.x > -100 && bullet.homingFrame < 40) {
      const next = steerVelocity(bullet.x, bullet.y, bullet.vx, bullet.vy, bullet.speed, target, 4);
      bullet.vx = next.vx;
      bullet.vy = next.vy;
      bullet.speed = next.speed;
    } else if (bullet.speed < 10) {
      const len = Math.hypot(bullet.vx, bullet.vy) || 1;
      bullet.speed = Math.min(10, bullet.speed + 0.33333333);
      bullet.vx = bullet.vx * bullet.speed / len;
      bullet.vy = bullet.vy * bullet.speed / len;
    }
    bullet.homingFrame++;
    return bullet;
  }

  function chooseHomingTarget(enemies) {
    let target = { x: -999, y: -999 };
    for (const enemy of enemies || []) {
      if (!enemy || enemy.dead || enemy.hp <= 0) continue;
      if (enemy.ecl && enemy.ecl.canTakeDamage === false) continue;
      if (target.y < enemy.y) target = { x: enemy.x, y: enemy.y };
    }
    return target;
  }

  function playerShotDamageForEnemy(damage, bombActive = false) {
    const base = Math.trunc(damage);
    if (!bombActive) return base;
    return base ? Math.max(1, Math.trunc(base / 3)) : 0;
  }

  function capEnemyFrameDamage(totalDamage) {
    return Math.max(0, Math.min(70, Math.trunc(totalDamage)));
  }

  function spellcardDamageForEnemy(cappedDamage, hitWithBombRegion = false, usedBomb = false) {
    const damage = Math.trunc(cappedDamage);
    if (damage <= 0) return 0;
    if (!hitWithBombRegion) return damage > 7 ? Math.trunc(damage / 7) : 1;
    if (usedBomb) return damage > 3 ? Math.trunc(damage / 3) : 1;
    return 0;
  }

  function createReimuABomb(player, rng) {
    if (typeof rng !== 'function') throw new Error('ReimuA Dream Seal requires the original game RNG stream');
    return {
      type: 'reimuA',
      label: 'Dream Seal',
      frame: 0,
      duration: 300,
      invuln: 360,
      initialized: false,
      rng,
      projectiles: Array.from({ length: 8 }, () => ({
        state: 0,
        stateFrame: 0,
        age: 0,
        charge: 0,
        x: player.x,
        y: player.y,
        vx: 0,
        vy: 0,
        speed: 4
      }))
    };
  }

  function createReimuBBomb(player) {
    return {
      type: 'reimuB',
      label: 'Evil Sealing Circle',
      frame: 0,
      duration: 140,
      invuln: 200,
      initialized: false,
      beams: [
        { x: player.x, y: 224, w: 62, h: 448 },
        { x: 192, y: player.y, w: 384, h: 62 },
        { x: player.x, y: 224, w: 62, h: 448 },
        { x: 192, y: player.y, w: 384, h: 62 }
      ]
    };
  }

  function createMarisaABomb(player) {
    return {
      type: 'marisaA',
      label: 'Stardust Reverie',
      frame: 0,
      duration: 250,
      invuln: 300,
      initialized: false,
      stars: Array.from({ length: 8 }, (_, i) => {
        const angle = i * TAU / 8;
        return {
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * 2,
          vy: Math.sin(angle) * 2,
          angle
        };
      })
    };
  }

  function createMarisaBBomb(player) {
    return {
      type: 'marisaB',
      label: 'Master Spark',
      frame: 0,
      duration: 300,
      invuln: 360,
      initialized: false,
      x: 192,
      y: player.y / 2,
      w: 384,
      h: player.y
    };
  }

  function updateReimuABomb(bomb, ctx) {
    const frame = bomb.frame;
    if (!bomb.initialized) {
      bomb.initialized = true;
      ctx.onClearItems?.();
      ctx.onText?.('Dream Seal');
      ctx.onParticles?.(12, ctx.player.x, ctx.player.y, 1, 0xff40ffff);
      ctx.onCancelBox?.(ctx.player.x, ctx.player.y, 256, 256);
    }

    if (frame >= 60 && frame < 180 && frame % 16 === 0) {
      const idx = Math.trunc((frame - 60) / 16);
      if (idx > 0 && idx < bomb.projectiles.length) {
        const p = bomb.projectiles[idx];
        const angle = bomb.rng() * TAU - Math.PI;
        p.state = 1;
        p.stateFrame = 0;
        p.age = 0;
        p.charge = 0;
        p.speed = 4;
        p.x = ctx.player.x;
        p.y = ctx.player.y;
        p.vx = Math.cos(angle) * p.speed;
        p.vy = Math.sin(angle) * p.speed;
        ctx.onSound?.(13);
      }
    }

    for (const p of bomb.projectiles) {
      if (!p.state) continue;
      if (p.state === 1) {
        const target = ctx.lastEnemyHit && ctx.lastEnemyHit.x > -100 ? ctx.lastEnemyHit : ctx.player;
        const next = steerVelocity(p.x, p.y, p.vx, p.vy, p.speed, target, 8);
        p.vx = next.vx;
        p.vy = next.vy;
        p.speed = next.speed;
        const landed = ctx.onDamageBox?.(p.x, p.y, 48, 48, 8, 'bomb') || 0;
        p.charge += landed;
        ctx.onCancelBox?.(p.x, p.y, 48, 48);
        if (p.charge >= 100 || frame >= bomb.duration - 30) {
          ctx.onParticles?.(6, p.x, p.y, 8, 0xffffffff);
          ctx.onParticles?.(12, p.x, p.y, 1, 0xff40ffff);
          ctx.onDamageBox?.(p.x, p.y, 256, 256, 200, 'bombExplosion');
          ctx.onCancelBox?.(p.x, p.y, 256, 256);
          p.state = 2;
          p.stateFrame = 2;
          ctx.onSound?.(15);
          ctx.onShake?.(16, 8);
        }
      } else if (p.state === 2) {
        p.stateFrame++;
        if (p.stateFrame >= 30) p.state = 0;
      }
      if (p.state) {
        p.age++;
        p.x += p.vx;
        p.y += p.vy;
      }
    }

    bomb.frame++;
    return bomb.frame < bomb.duration;
  }

  function updateReimuBBomb(bomb, ctx) {
    if (!bomb.initialized) {
      bomb.initialized = true;
      ctx.onClearItems?.();
      ctx.onText?.(bomb.label);
      ctx.onSound?.(6);
      ctx.onShake?.(60, 2);
    }
    if (bomb.frame === 60) ctx.onShake?.(80, 20);
    if (bomb.frame > 0 && bomb.frame % 2 !== 0) {
      for (let i = 0; i < bomb.beams.length; i++) {
        const beam = bomb.beams[i];
        const frame = ctx.onBombFrame?.('reimuB', i, bomb.frame);
        const x = beam.x + (frame?.posOffsetX || 0);
        const y = beam.y + (frame?.posOffsetY || 0);
        ctx.onDamageBox?.(x, y, beam.w, beam.h, 8, 'bombReimuB');
        ctx.onCancelBox?.(x, y, beam.w, beam.h);
      }
    }
    bomb.frame++;
    return bomb.frame < bomb.duration;
  }

  function updateMarisaABomb(bomb, ctx) {
    if (!bomb.initialized) {
      bomb.initialized = true;
      ctx.onClearItems?.();
      ctx.onText?.(bomb.label);
      ctx.onSound?.(6);
      ctx.onShake?.(120, 4);
    } else {
      for (const star of bomb.stars) {
        star.x += star.vx;
        star.y += star.vy;
        if (bomb.frame % 3 !== 0) {
          ctx.onDamageBox?.(star.x, star.y, 128, 128, 8, 'bombMarisaA');
          ctx.onCancelBox?.(star.x, star.y, 128, 128);
        }
      }
    }
    bomb.frame++;
    return bomb.frame < bomb.duration;
  }

  function updateMarisaBBomb(bomb, ctx) {
    if (!bomb.initialized) {
      bomb.initialized = true;
      ctx.onClearItems?.();
      ctx.onText?.(bomb.label);
      ctx.onSound?.(19);
    } else {
      if (bomb.frame === 60) ctx.onShake?.(60, 1);
      else if (bomb.frame === 120) ctx.onShake?.(200, 24);
      if (bomb.frame % 4 !== 0) {
        bomb.y = ctx.player.y / 2;
        bomb.h = ctx.player.y;
        ctx.onDamageBox?.(192, bomb.y, 384, bomb.h, 12, 'bombMarisaB');
        ctx.onCancelBox?.(192, bomb.y, 384, bomb.h);
      }
    }
    bomb.frame++;
    return bomb.frame < bomb.duration;
  }

  function stage1SpellName(index) {
    const name = STAGE1_META.spells[index];
    if (!name) throw new Error(`Unknown Stage 1 spell index: ${index}`);
    return name;
  }

  function stageMeta(stageNumber) {
    const meta = STAGE_META[stageNumber | 0];
    if (!meta) throw new Error(`Unknown TH06 stage metadata: ${stageNumber}`);
    return meta;
  }

  function spellName(index) {
    const name = SPELL_NAMES[index | 0];
    if (!name) throw new Error(`Unknown TH06 spell index: ${index}`);
    return name;
  }

  globalThis.TH06Logic = {
    DIALOGUE_ZH_CN,
    DIFFICULTY_INFO,
    POWER_UP_THRESHOLDS,
    EXTRA_LIFE_SCORES,
    MAX_SCORE,
    MAX_LIVES,
    ENEMY_BULLET_CAP,
    POWER_ITEM_SCORE,
    SPELLCARD_SCORE,
    PLAYER_SYSTEM,
    BULLET_TYPE_NAMES,
    SFX_BUFFER_IDX_VOLUME,
    STAGE1_META,
    STAGE2_META,
    STAGE3_META,
    STAGE4_META,
    STAGE5_META,
    STAGE6_META,
    STAGE_META,
    bulletGrazeSize,
    adjustRankState,
    collectPowerItem,
    effectColorById,
    effectColorCss,
    pointBulletScore,
    pointItemScore,
    spellcardBonus,
    stageClearBonus,
    createReimuABomb,
    createReimuBBomb,
    createMarisaABomb,
    createMarisaBBomb,
    localizeDialogueText,
    missPowerDrops,
    stageMeta,
    stage1SpellName,
    spellName,
    updateHomingBullet,
    chooseHomingTarget,
    playerShotDamageForEnemy,
    capEnemyFrameDamage,
    spellcardDamageForEnemy,
    shootIntervalForRank,
    updateReimuABomb,
    updateReimuBBomb,
    updateMarisaABomb,
    updateMarisaBBomb
  };
})();
