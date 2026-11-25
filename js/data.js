'use strict';
/* ============ СЕРЫЙ ЛЕС — данные, таблицы лута, рецепты ============ */

// ---- утилиты ----
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dst=(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);

// ---- мир ----
const TS=16; // размер тайла, px
const MAPW=112, MAPH=86;// размер карты в тайлах
const TIME_MIN_PER_SEC=2; // игровых минут за реальную секунду
const DAY_START=7;

const TILE={GRASS_A:0,GRASS_B:1,TALL:2,TREE:3,BUSH:4,WATER:5,BRIDGE:6,ROAD:7,DIRT:8,
  WFLOOR:9,CFLOOR:10,WALL:11,WWALL:12,DOOR:13,RUBBLE:14,MAT:15,FENCE:16};
const SOLID_T=new Set([TILE.TREE,TILE.BUSH,TILE.WATER,TILE.WALL,TILE.WWALL,TILE.FENCE]);
const LOS_T=new Set([TILE.WALL,TILE.WWALL,TILE.TREE]);

// ---- редкости: обычная → необычная → редкая → эпическая → легендарная → УНИКАЛЬНАЯ (красная)
const RAR=['#a7a29a','#78c27d','#5aa7e0','#b06fd8','#e2a04f','#e0413a'];
const RAR_N=['обычная','необычная','редкая','эпическая','легендарная','УНИКАЛЬНАЯ'];

// ---- предметы ----
const ITEMS={
  scrap:{n:'Металлолом',t:'mat',r:0,stk:20,d:'Ржавые ошмётки железа. Основа любой мастерской.'},
  wood:{n:'Дрова',t:'mat',r:0,stk:20,d:'Охапка сырых веток. Всё лучше, чем ничего.'},
  cloth:{n:'Ветошь',t:'mat',r:0,stk:20,d:'Грязные полосы ткани. Пахнет железом и плесенью.'},
  tape:{n:'Изолента',t:'mat',r:0,stk:10,d:'Чёрная, липкая, держит всё — даже нервную.'},
  rope:{n:'Верёвка',t:'mat',r:1,stk:4,d:'Крученая из старого ремня. Нужна для растяжек.'},
  pipe:{n:'Стальная труба',t:'mat',r:2,stk:3,d:'Ржавая изнутри, крепкая снаружи. Основа самопального оружия.'},
  battery:{n:'Батарейка',t:'mat',r:1,stk:8,d:'Клик в рюкзаке — зарядить фонарь. Пригодится и на верстаке.'},
  beans:{n:'Банка фасоли',t:'food',r:0,stk:3,food:28,d:'Чей-то ужин. Ещё съедобный.'},
  stew:{n:'Холодные щи',t:'food',r:0,stk:3,food:22,thirst:10,d:'Были бы горячими — цены бы не было.'},
  groats:{n:'Сухая крупа',t:'food',r:0,stk:6,food:14,d:'Грызть бесполезно. Костёр решает.'},
  cookies:{n:'Печенье',t:'food',r:1,stk:6,food:18,d:'Сладкая крошка из помятой коробки.'},
  hotstew:{n:'Горячие щи',t:'food',r:1,stk:3,food:40,thirst:14,hp:8,d:'Горячее, жирное, живое.'},
  hotbeans:{n:'Горячая фасоль',t:'food',r:1,stk:3,food:36,hp:4,d:'Томатная подлива снова пахнет летом.'},
  porridge:{n:'Каша',t:'food',r:2,stk:4,food:46,thirst:24,hp:6,d:'Густая, горячая, своя.'},
  broth:{n:'Наваристый бульон',t:'food',r:3,stk:3,food:55,thirst:40,hp:18,d:'Густой мясной отвар с кореньями. Быстро ставит на ноги.'},
  meat:{n:'Сырое мясо',t:'food',r:0,stk:3,food:24,v:12,d:'Трофей с твари. Торг платит за него охотно.'},
  hotmeat:{n:'Жареное мясо',t:'food',r:1,stk:3,food:44,hp:6,d:'Пахнет почти как нормальная жизнь.'},
  mre:{n:'Армейский сухпаёк',t:'food',r:4,stk:2,food:75,thirst:45,hp:12,d:'Непривлекательная упаковка. Внутри есть и фляга с концентратом.'},
  water:{n:'Бутылка воды',t:'water',r:0,stk:3,thirst:45,d:'Пол-литра отфильтрованной дождевой.'},
  tea:{n:'Заварка',t:'water',r:1,stk:4,thirst:55,hp:3,d:'Крепкая, тёмная, почти без вкуса.'},
  thermos:{n:'Термос',t:'water',r:3,stk:2,thirst:85,hp:5,d:'Держит тепло сутки. Из другого мира.'},
  bandage:{n:'Бинт',t:'med',r:0,stk:5,heal:12,bleed:1,d:'Останавливает кровь. Щиплет.'},
  painkillers:{n:'Таблетки',t:'med',r:1,stk:5,heal:22,bleed:1,d:'Горсть из блистера. Без названия.'},
  tincture:{n:'Настойка',t:'med',r:2,stk:4,heal:34,bleed:1,d:'Горькая, тёмная, работает быстрее, чем думаешь.'},
  medkit:{n:'Полевая аптечка',t:'med',r:3,stk:2,heal:55,bleed:1,d:'Спасение, завёрнутое в брезент.'},
  morphine:{n:'Морфин',t:'med',r:4,stk:2,heal:78,bleed:1,d:'Одна ампула — и лес отходит на второй план.'},
  surgical:{n:'Хирургический набор',t:'med',r:5,stk:1,heal:115,bleed:1,d:'Красная жестянка. Такое не находят дважды.'},
  flashlight:{n:'Фонарь',t:'gear',r:2,d:'Клавиша F. Садит батарейки, но ночью без него — смерть.'},
  trap:{n:'Ловушка-растяжка',t:'place',r:3,d:'Ставится у забора (E). Пружина, лезвия, много шума.'},
  cans:{n:'Сигнальная жестянка',t:'place',r:1,d:'Звякает, когда кто-то задевает леску. Ставится (E).'},
  knife:{n:'Нож',t:'blade',r:0,w:{dmg:22,cd:.5,reach:30,bleed:1}},
  saw:{n:'Ножовка',t:'blade',r:1,w:{dmg:31,cd:.75,reach:28,bleed:1},d:'Полотно из мастерской. Зубья цепляют всё.'},
  axe:{n:'Топор',t:'blade',r:2,w:{dmg:42,cd:.95,reach:34,bleed:1}},
  pistol:{n:'Пистолет ПМ',t:'gun',r:2,w:{dmg:20,cd:.36,mag:8,rel:1.7,spread:.05,spd:560,life:.45,noise:11,ammo:'ammo_p'}},
  revolver:{n:'Револьвер «Рысь»',t:'gun',r:3,w:{dmg:36,cd:.66,mag:6,rel:2.6,spread:.035,spd:620,life:.55,noise:12,ammo:'ammo_p'}},
  shotgun:{n:'Обрез',t:'gun',r:3,w:{dmg:9,pellets:8,cd:1.05,mag:2,rel:2.2,spread:.16,spd:470,life:.22,noise:13,ammo:'ammo_s',bleed:1}},
  smg:{n:'ППС-90',t:'gun',r:4,w:{dmg:15,cd:.12,mag:25,rel:2.8,spread:.12,spd:560,life:.35,noise:12,ammo:'ammo_p'}},
  rifle:{n:'Охотничья винтовка',t:'gun',r:4,w:{dmg:44,cd:1.25,mag:5,rel:2.1,spread:.015,spd:830,life:.65,noise:14,ammo:'ammo_r',bleed:1}},
  lever:{n:'Карабин с рычагом',t:'gun',r:5,w:{dmg:58,cd:.62,mag:8,rel:2.0,spread:.018,spd:800,life:.62,noise:14,ammo:'ammo_r',bleed:1}},
  ammo_p:{n:'Патроны 9 мм',t:'ammo',r:0,stk:30,d:'Латунные, тяжёлые, громкие.'},
  ammo_s:{n:'Патроны 12 калибр',t:'ammo',r:1,stk:20,d:'Картечь. Для близких разговоров.'},
  ammo_r:{n:'Патроны 7.62',t:'ammo',r:2,stk:20,d:'Один выстрел — одна проблема.'},
  coins:{n:'Пригоршня монет',t:'val',r:1,v:15,d:'Мелочь из другого мира.'},
  ring:{n:'Обручальное кольцо',t:'val',r:2,v:40,d:'Гравировка: «Только ты».'},
  pouch:{n:'Кошелёк',t:'val',r:2,v:65,d:'Тяжёлый. Не спрашивай, что внутри.'},
  watch:{n:'Карманные часы',t:'val',r:3,v:95,d:'Остановились в 03:17.'},
  necklace:{n:'Ожерелье',t:'val',r:4,v:170,d:'Капли холодные. Застёжка целая.'},
  idol:{n:'Резной идол',t:'val',r:5,v:240,d:'Тёмное дерево. Смотрит, даже когда ящик закрыт.'},
  gold_bar:{n:'Слиток золота',t:'val',r:5,v:300,d:'Тяжелее, чем кажется. Теплее, чем должно быть.'},
};

// ---- таблицы лута: каждая таблица — строго своя редкость ----
// поэтому цвет контейнера = редкость самой ценной вещи внутри
const LOOT={
  common:[['scrap',26],['wood',20],['cloth',18],['tape',10],['beans',11],['stew',8],
    ['groats',8],['water',22],['bandage',9],['ammo_p',9],['meat',5],['knife',3]],
  uncommon:[['rope',10],['battery',12],['cookies',11],['tea',16],['water',14],['painkillers',12],
    ['ammo_s',12],['cans',6],['saw',8],['coins',10]],
  rare:[['pipe',12],['flashlight',9],['tincture',11],['ring',9],['pouch',8],
    ['porridge',9],['axe',9],['ammo_r',12],['pistol',5]],
  epic:[['revolver',10],['shotgun',10],['medkit',14],['watch',10],['trap',9],['thermos',16]],
  legendary:[['mre',14],['morphine',14],['smg',12],['rifle',14],['necklace',12]],
  ultra:[['gold_bar',20],['idol',22],['surgical',20],['lever',16]],
};

// ---- типы контейнеров: rolls = [таблица, кол-во, вероятность] ----
// open — сколько держать E, srch — сколько секунд искать ОДИН предмет
const CTYPE={
  cupboard:{n:'Буфет',   rolls:[['common',2],['uncommon',1,.55]], open:.8, srch:1.5},
  crate:   {n:'Ящик',    rolls:[['common',2],['uncommon',1,.45]], open:.9, srch:1.6},
  bigcrate:{n:'Большой ящик', rolls:[['common',3],['uncommon',1,.7],['rare',1,.25],['legendary',1,.12]], open:1.2, srch:1.9},
  toolbox: {n:'Ящик инструментов',rolls:[['common',2],['uncommon',1,.8],['rare',1,.15]], open:.7, srch:1.4},
  shelf:   {n:'Стеллаж', rolls:[['common',2],['uncommon',1,.6],['rare',1,.3],['epic',1,.12]], open:.9, srch:1.7},
  barrel:  {n:'Бочка',   rolls:[['common',1],['uncommon',1,.5]],  open:.8, srch:1.3},
  safe:    {n:'Сейф',    rolls:[['rare',1,.9],['epic',1,.5],['legendary',1,.35],['ultra',1,.12],['uncommon',2]], open:2.2, srch:3.0, noise:6},
  corpse:  {n:'Останки', rolls:[['common',1],['uncommon',1,.5]],  open:1, srch:1.3},
  ground:  {n:'Помои',   rolls:[['common',1],['uncommon',1,.3]],  open:.4, srch:.9},
  // личный схрон в лагере: 20 ячеек, сначала пуст, не обновляется и не портится ночёжками
  stash:   {n:'Схрон',   rolls:[], open:.5, srch:.4, own:1, slots:40},
};

// ---- крафт (верстак) и готовка (костёр) ----
const RECIPES=[
  {lv:1,out:['bandage',2],   in:[['cloth',2]]},
  {lv:1,out:['tape',3],      in:[['cloth',1],['scrap',1]]},
  {lv:1,out:['rope',1],      in:[['cloth',3]]},
  {lv:1,out:['saw',1],       in:[['scrap',3],['wood',1]]},
  {lv:1,out:['axe',1],       in:[['scrap',4],['wood',2]]},
  {lv:1,out:['ammo_p',6],    in:[['scrap',3]]},
  {lv:1,out:['cans',2],      in:[['scrap',2],['cloth',1]]},
  {lv:1,out:['flashlight',1],in:[['battery',2],['scrap',2]]},
  {lv:2,out:['pipe',1],      in:[['scrap',5],['wood',2]]},
  {lv:2,out:['ammo_s',4],    in:[['scrap',3],['wood',1]]},
  {lv:2,out:['medkit',1],    in:[['bandage',2],['cloth',1]]},
  {lv:2,out:['tincture',1],  in:[['painkillers',1],['cloth',1],['wood',1]]},
  {lv:2,out:['pistol',1],    in:[['scrap',6],['cloth',1],['battery',1]]},
  {lv:2,out:['shotgun',1],   in:[['scrap',9],['wood',4],['cloth',1]]},
  {lv:1,out:['trap',1],      in:[['scrap',3],['wood',2],['cloth',1]]},
  {lv:3,out:['ammo_r',3],    in:[['scrap',4],['battery',1]]},
  {lv:3,out:['morphine',1],  in:[['medkit',1],['cloth',2],['battery',1]]},
  {lv:3,out:['surgical',1],  in:[['medkit',2],['tape',2],['morphine',1]]},
  {lv:3,out:['smg',1],       in:[['pipe',2],['scrap',8],['battery',2],['ammo_p',6]]},
  {lv:3,out:['lever',1],     in:[['pipe',2],['scrap',12],['wood',4],['ammo_r',6]]},
];
const COOK=[
  {lv:1,out:['hotstew',1],   in:[['stew',1]]},
  {lv:1,out:['hotbeans',1],  in:[['beans',1]]},
  {lv:2,out:['hotmeat',1],   in:[['meat',1]]},
  {lv:2,out:['tea',1],       in:[['water',1],['cookies',1]]},
  {lv:3,out:['porridge',1],  in:[['groats',1],['water',1]]},
  {lv:3,out:['broth',1],     in:[['meat',1],['water',1]]},
];
const BASE_UPG={
  bench:{
    1:{n:'Деревянный верстак',desc:'Базовые инструменты и бинты.'},
    2:{n:'Слесарный верстак',cost:[['scrap',6],['wood',4],['tape',2]],desc:'Открывает чертежи 2 ур. (пистолет, обрез, аптечки).'},
    3:{n:'Оружейная мастерская',cost:[['scrap',12],['pipe',3],['battery',3],['tape',3]],desc:'Открывает чертежи 3 ур. (ППС-90, карабин, морфин).'}
  },
  stash:{
    1:{n:'Деревянный схрон',slots:40,desc:'40 ячеек.'},
    2:{n:'Обитый сундук',slots:70,cost:[['wood',8],['scrap',6],['rope',2]],desc:'Расширяет схрон до 70 ячеек.'},
    3:{n:'Армейский сейф',slots:100,cost:[['scrap',12],['pipe',2],['tape',4]],desc:'Расширяет схрон до 100 ячеек.'}
  },
  tent:{
    1:{n:'Рваная палатка',heal:35,healLow:12,hLoss:25,tLoss:20,vig:0,spd:1,desc:'Лечение +35/+12, голод -25, жажда -20.'},
    2:{n:'Утеплённый шатёр',cost:[['cloth',8],['wood',6],['rope',3]],heal:55,healLow:28,hLoss:16,tLoss:12,vig:180,spd:1.22,desc:'Лечение +55/+28, голод -16, жажда -12, баф «БОДРЫЙ» (+22% скорости на 3 мин).'},
    3:{n:'Укреплённый барак',cost:[['wood',10],['scrap',8],['cloth',6],['tape',2]],heal:85,healLow:50,hLoss:8,tLoss:6,vig:320,spd:1.30,desc:'Лечение +85/+50, голод -8, жажда -6, баф «БОДРЫЙ» (+30% скорости на 5 мин).'}
  },
  fire:{
    1:{n:'Кострище',light:105,desc:'Разогрев консервов.'},
    2:{n:'Очаг с треногой',cost:[['wood',6],['scrap',4]],light:130,desc:'Открывает жарку мяса и заварку, свет шире.'},
    3:{n:'Печь-буржуйка',cost:[['scrap',10],['pipe',2],['wood',4]],light:160,desc:'Открывает кашу и наваристый бульон, мощный свет.'}
  },
  door:{
    1:{n:'Соломенная дверь',maxHp:60,thorns:0,desc:'Хлипкая соломенная заслонка (60 HP).'},
    2:{n:'Деревянная дверь',cost:[['wood',6],['scrap',2]],maxHp:130,thorns:0,desc:'Крепкие дубовые доски (130 HP).'},
    3:{n:'Железная дверь',cost:[['scrap',10],['tape',2]],maxHp:240,thorns:5,desc:'Листовое железо (240 HP), ранит тварей при атаке.'},
    4:{n:'Кирпичная дверь',cost:[['scrap',10],['wood',8],['pipe',2]],maxHp:380,thorns:8,desc:'Усиленная кирпичная кладка (380 HP), шипы ранят врагов.'},
    5:{n:'Бетонная дверь',cost:[['scrap',16],['pipe',4],['tape',4]],maxHp:580,thorns:14,desc:'Монолитный бетонный шлюз (580 HP), сильные шипы и замедление.'}
  }
};

function dayL(h){ // уровень дневного света 0..1
  if(h<5||h>21)return 0;
  if(h<7)return (h-5)/2;
  if(h>19)return (21-h)/2;
  return 1;
}

const SIDE_N={W:'запад',E:'восток',N:'север',S:'юг'};
const TRADE_OFFERS=[
  {get:['ammo_p',6],cost:15},
  {get:['ammo_s',5],cost:25},
  {get:['tincture',2],cost:28},
  {get:['medkit',1],  cost:34},
  {get:['flashlight',1],cost:35},
  {get:['rope',2],    cost:22},
  {get:['ammo_r',6],  cost:48},
  {get:['pouch',1],   cost:52},
  {get:['pistol',1],  cost:55},
  {get:['thermos',1],cost:60},
  {get:['shotgun',1],cost:90},
  {get:['revolver',1],cost:110},
  {get:['morphine',2],cost:120},
  {get:['mre',2],     cost:130},
];
const TRADER_LINES=[
  'Торг: Пахнет мясом. Твоим или своим?',
  'Торг: Зубы, колечки, мясо... всё считается.',
  'Торг: Не спрашивай, откуда патроны. Спрашивай, почём.',
  'Торг: У тебя мягкие руки. У меня острый нож. Дружим?',
];
const TRADER_BUY=['Торг: Не чавкай.','Торг: Товар — назад не меняю.','Торг: Уходи, пока я добрый.'];
