export type GuesthouseLocale = "ko" | "en" | "ja" | "zh";

type LocalizedText = Record<GuesthouseLocale, string>;

export type GuesthouseFaq = {
  id: string;
  keywords: string[];
  question: LocalizedText;
  answer: LocalizedText;
};

export const guesthouseFaq: GuesthouseFaq[] = [
  {
    id: "services",
    keywords: ["자전거", "수건", "세제", "대여", "판매", "가격", "bike", "towel", "detergent", "レンタル", "タオル", "洗剤", "自行车", "毛巾", "洗涤剂"],
    question: { ko: "유료 서비스 가격은 얼마인가요?", en: "How much are the paid services?", ja: "有料サービスの料金はいくらですか？", zh: "付费服务多少钱？" },
    answer: {
      ko: "자전거 대여는 2,000원, 수건 판매는 2,000원, 캡슐 세제는 1,000원입니다.",
      en: "Bike rental is KRW 2,000, a towel is KRW 2,000, and one detergent capsule is KRW 1,000.",
      ja: "自転車レンタルは2,000ウォン、タオル販売は2,000ウォン、洗剤カプセルは1,000ウォンです。",
      zh: "自行车租赁2,000韩元，毛巾2,000韩元，洗衣凝珠1,000韩元。",
    },
  },
  {
    id: "wifi",
    keywords: ["와이파이", "wifi", "인터넷", "비밀번호", "password", "パスワード", "密码", "网络"],
    question: { ko: "와이파이 비밀번호는 무엇인가요?", en: "What is the Wi-Fi password?", ja: "Wi-Fiのパスワードは何ですか？", zh: "Wi-Fi密码是什么？" },
    answer: { ko: "공용 와이파이 비밀번호는 bucket1234입니다.", en: "The shared Wi-Fi password is bucket1234.", ja: "共用Wi-Fiのパスワードは bucket1234 です。", zh: "公共Wi-Fi密码是 bucket1234。" },
  },
  {
    id: "smoking",
    keywords: ["흡연", "담배", "smoking", "smoke", "喫煙", "タバコ", "吸烟"],
    question: { ko: "흡연 장소는 어디인가요?", en: "Where is the smoking area?", ja: "喫煙場所はどこですか？", zh: "吸烟区在哪里？" },
    answer: { ko: "지정 흡연 장소는 외부 테라스 왼쪽입니다. 공용공간 운영시간인 07:00~23:00에 이용해 주세요.", en: "The designated smoking area is on the left side of the outdoor terrace. Please use it between 07:00 and 23:00.", ja: "指定喫煙場所は屋外テラスの左側です。07:00〜23:00にご利用ください。", zh: "指定吸烟区位于室外露台左侧，请在07:00至23:00使用。" },
  },
  {
    id: "common-room",
    keywords: ["거실", "스페이스룸", "도서", "다트", "보드게임", "전자레인지", "living", "game", "microwave", "リビング", "ゲーム", "電子レンジ", "客厅", "游戏", "微波炉"],
    question: { ko: "1층 거실에서는 무엇을 할 수 있나요?", en: "What can I use in the first-floor living room?", ja: "1階のリビングでは何ができますか？", zh: "一楼客厅可以做什么？" },
    answer: {
      ko: "1층 거실(스페이스룸)에서는 07:00~23:00에 식사와 대화를 할 수 있으며 전자레인지, 도서, 다트, 보드게임을 자유롭게 이용할 수 있습니다. 사용 후에는 정리해 제자리에 두어야 합니다. 음주는 23:00 이전에만 가능합니다.",
      en: "From 07:00 to 23:00, you may eat and talk in the first-floor living room and use the microwave, books, darts, and board games. Return everything after use. Alcohol is allowed only before 23:00.",
      ja: "1階のリビングは07:00〜23:00に食事や会話ができ、電子レンジ、本、ダーツ、ボードゲームを自由に利用できます。使用後は元の場所に戻してください。飲酒は23:00までです。",
      zh: "一楼客厅07:00至23:00可用餐、交谈，并可使用微波炉、书籍、飞镖和桌游。使用后请整理归位。饮酒仅限23:00之前。",
    },
  },
  {
    id: "kitchen",
    keywords: ["주방", "조리", "화구", "조미료", "식재료", "kitchen", "cook", "seasoning", "キッチン", "調理", "調味料", "厨房", "烹饪", "调味料"],
    question: { ko: "주방에서 조리할 수 있나요?", en: "Can I cook in the kitchen?", ja: "キッチンで調理できますか？", zh: "可以在厨房做饭吗？" },
    answer: {
      ko: "1층 주방의 일부 조리도구는 07:00~23:00에 사용할 수 있지만 업소용 화구는 사용할 수 없습니다. 기본 조미료와 식재료는 제공하지 않으므로 직접 준비해 주세요.",
      en: "Some kitchen tools may be used from 07:00 to 23:00, but the commercial stove is not available. Seasonings and ingredients are not provided.",
      ja: "1階キッチンの一部調理器具は07:00〜23:00に使用できますが、業務用コンロは使用できません。調味料と食材は各自でご用意ください。",
      zh: "一楼厨房的部分厨具可在07:00至23:00使用，但商用炉灶不可使用。调味料和食材需自行准备。",
    },
  },
  {
    id: "laundry",
    keywords: ["세탁", "빨래", "건조", "냉장고", "쓰레기", "분리수거", "laundry", "washer", "dry", "trash", "洗濯", "乾燥", "ゴミ", "洗衣", "晾晒", "垃圾"],
    question: { ko: "세탁과 쓰레기 배출은 어떻게 하나요?", en: "How do I use the laundry and dispose of trash?", ja: "洗濯とゴミ出しはどうすればいいですか？", zh: "如何洗衣和处理垃圾？" },
    answer: {
      ko: "세탁실은 1층 식당 안쪽에 있으며 세탁기와 냉장고는 무료입니다. 분리수거와 일반쓰레기 배출 장소는 세탁실 안쪽입니다. 세탁물은 외부 테라스 오른쪽 건조대에서 말리고 집게로 고정해 주세요. 분실 시 숙소는 책임지지 않습니다.",
      en: "The laundry room is behind the first-floor dining area. The washer and refrigerator are free. Recycling and general waste bins are inside the laundry area. Dry clothes on the rack to the right of the outdoor terrace and secure them with clips. The guesthouse is not responsible for lost laundry.",
      ja: "ランドリールームは1階食堂の奥にあり、洗濯機と冷蔵庫は無料です。分別ゴミと一般ゴミの場所もランドリー内です。洗濯物は屋外テラス右側の物干し台で、洗濯ばさみで固定してください。紛失について宿は責任を負いません。",
      zh: "洗衣房位于一楼餐厅内侧，洗衣机和冰箱免费使用。分类及一般垃圾桶也在洗衣房内。衣物请在室外露台右侧晾衣架上晾晒并用夹子固定，遗失由客人自行负责。",
    },
  },
  {
    id: "facilities",
    keywords: ["정수기", "화장실", "피아노", "코워킹", "빔프로젝터", "water", "toilet", "piano", "coworking", "projector", "浄水器", "トイレ", "ピアノ", "净水器", "卫生间", "钢琴"],
    question: { ko: "공용 편의시설은 어디에 있나요?", en: "Where are the shared facilities?", ja: "共用設備はどこにありますか？", zh: "公共设施在哪里？" },
    answer: {
      ko: "정수기는 1층 식당에 있습니다. 1층 로비 피아노, 1.5층 코워킹마루, 1층 외부 랩실 빔프로젝터도 자유롭게 사용할 수 있습니다. 공용공간은 07:00~23:00 운영되며 정수기와 공용화장실은 23:00 이후에도 사용할 수 있지만 가급적 이전 이용을 권장합니다.",
      en: "The water dispenser is in the first-floor dining area. You may also use the lobby piano, the 1.5-floor coworking area, and the projector in the outdoor lab room. Shared spaces operate from 07:00 to 23:00. The water dispenser and shared restroom remain available after 23:00, but earlier use is recommended.",
      ja: "浄水器は1階食堂にあります。1階ロビーのピアノ、1.5階コワーキングスペース、1階屋外ラボ室のプロジェクターも利用できます。共用スペースは07:00〜23:00です。浄水器と共用トイレは23:00以降も使えますが、できるだけ早めにご利用ください。",
      zh: "饮水机位于一楼餐厅。还可使用一楼大厅钢琴、1.5楼共享办公区和一楼室外实验室投影仪。公共空间开放时间为07:00至23:00；饮水机和公共卫生间23:00后仍可使用，但建议尽量提前使用。",
    },
  },
  {
    id: "room-rules",
    keywords: ["객실", "음식", "에어컨", "샴푸", "바디워시", "드라이기", "room", "food", "aircon", "shampoo", "dryer", "客室", "エアコン", "シャンプー", "房间", "空调", "洗发水"],
    question: { ko: "객실 이용 규칙과 제공 물품은 무엇인가요?", en: "What are the room rules and amenities?", ja: "客室のルールと備品を教えてください。", zh: "客房规则和用品有哪些？" },
    answer: {
      ko: "객실에서는 커피와 물만 섭취할 수 있으며 과자, 단백질바, 빵 등 음식은 금지됩니다. 퇴실 시 에어컨을 꺼 주세요. 샴푸와 바디워시는 기본 제공되고 공용 드라이기가 구비되어 있습니다. 수건은 개인 지참 또는 구매가 필요합니다.",
      en: "Only coffee and water are allowed in rooms; snacks, protein bars, bread, and other food are prohibited. Turn off the air conditioner when checking out. Shampoo, body wash, and a shared hair dryer are provided. Bring or purchase your own towel.",
      ja: "客室ではコーヒーと水のみ飲食可能で、お菓子、プロテインバー、パンなどは禁止です。退室時はエアコンを切ってください。シャンプー、ボディソープ、共用ドライヤーはあります。タオルは持参または購入してください。",
      zh: "客房内仅可饮用咖啡和水，禁止食用零食、蛋白棒、面包等。退房时请关闭空调。提供洗发水、沐浴露和公用吹风机；毛巾需自带或购买。",
    },
  },
  {
    id: "alcohol",
    keywords: ["음주", "술", "23시", "alcohol", "drink", "11pm", "飲酒", "お酒", "酒", "晚上11"],
    question: { ko: "23시 이후 음주할 수 있나요?", en: "Can I drink alcohol after 23:00?", ja: "23時以降に飲酒できますか？", zh: "23:00以后可以饮酒吗？" },
    answer: { ko: "23:00 이후에는 버킷게스트하우스 내 모든 장소에서 음주할 수 없습니다.", en: "Alcohol is prohibited everywhere inside Bucket Guesthouse after 23:00.", ja: "23:00以降はバケットゲストハウス内のすべての場所で飲酒禁止です。", zh: "23:00以后，Bucket Guesthouse内所有区域禁止饮酒。" },
  },
  {
    id: "lost-found",
    keywords: ["분실", "로스트", "잃어", "식품", "lost", "found", "food", "紛失", "忘れ物", "食品", "失物", "丢失", "食品"],
    question: { ko: "분실물은 어디에서 찾나요?", en: "Where can I find lost property?", ja: "忘れ物はどこで確認できますか？", zh: "在哪里寻找失物？" },
    answer: {
      ko: "23:00 이후 수거된 분실물은 프런트(리셉션) 앞 로스트함으로 이동됩니다. 식품도 별도 냉장보관 없이 같은 로스트함으로 옮겨지므로 변질이나 폐기를 막기 위해 직접 잘 관리해 주세요.",
      en: "Items collected after 23:00 are moved to the lost-property box in front of reception. Food is placed in the same box without refrigeration, so please manage food and personal belongings carefully.",
      ja: "23:00以降に回収された忘れ物は、フロント前のロストボックスへ移されます。食品も冷蔵せず同じ箱に移されるため、ご自身で十分に管理してください。",
      zh: "23:00后收集的失物会移至前台（接待处）前的失物箱。食品也不会冷藏，而是放入同一失物箱，请妥善保管个人物品和食品。",
    },
  },
  {
    id: "first-aid",
    keywords: ["응급", "약", "밴드", "마데카솔", "후시딘", "두통", "생리", "감기", "first aid", "medicine", "bandage", "薬", "救急", "生理用品", "急救", "药品", "创可贴", "卫生巾"],
    question: { ko: "응급약품이 있나요?", en: "Are first-aid supplies available?", ja: "救急用品はありますか？", zh: "有急救药品吗？" },
    answer: {
      ko: "밴드, 마데카솔, 후시딘, 두통약, 생리통약, 생리대, 감기약 등 급한 상황에 대처할 수 있는 기본 응급용품이 준비되어 있습니다. 재고에 따라 일부 품목은 없을 수 있으니 프런트에 문의해 주세요.",
      en: "Basic first-aid supplies include bandages, wound ointments, headache and menstrual-pain medicine, sanitary pads, and cold medicine. Some items may be out of stock; please ask reception.",
      ja: "絆創膏、傷用軟膏、頭痛薬、生理痛薬、生理用品、風邪薬などの基本的な救急用品があります。在庫切れの場合があるため、フロントへお問い合わせください。",
      zh: "备有创可贴、伤口软膏、头痛药、痛经药、卫生巾及感冒药等基本急救用品。部分用品可能缺货，请向前台咨询。",
    },
  },
];

export const localeCopy: Record<GuesthouseLocale, {
  language: string;
  greeting: string;
  suggestions: string;
  placeholder: string;
  send: string;
  source: string;
  fallback: string;
}> = {
  ko: { language: "언어", greeting: "안녕하세요, 버킷 AI예요. 숙소 이용 안내와 주변 장소를 질문해 주세요.", suggestions: "이런 질문을 해보세요", placeholder: "예: 와이파이 비밀번호가 뭐야?", send: "보내기", source: "숙소 공식 이용 안내", fallback: "질문과 정확히 일치하는 안내를 찾지 못했어요. 프런트에 문의하거나 아래 추천 질문을 이용해 주세요." },
  en: { language: "Language", greeting: "Hi, I’m Bucket AI. Ask me about guesthouse rules, facilities, or nearby places.", suggestions: "Try one of these", placeholder: "Example: What is the Wi-Fi password?", send: "Send", source: "Official guesthouse guide", fallback: "I couldn’t find an exact match. Please ask reception or try one of the suggested questions." },
  ja: { language: "言語", greeting: "こんにちは、Bucket AIです。宿のルールや設備、周辺スポットについて質問してください。", suggestions: "おすすめの質問", placeholder: "例：Wi-Fiのパスワードは？", send: "送信", source: "宿泊施設公式案内", fallback: "一致する案内が見つかりませんでした。フロントにお問い合わせいただくか、おすすめの質問をお試しください。" },
  zh: { language: "语言", greeting: "您好，我是Bucket AI。您可以询问住宿规则、设施或周边地点。", suggestions: "试试这些问题", placeholder: "例如：Wi-Fi密码是什么？", send: "发送", source: "住宿官方指南", fallback: "未找到完全匹配的说明。请咨询前台或尝试推荐问题。" },
};

