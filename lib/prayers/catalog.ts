import type { Prayer, PrayerSet } from "./types";

/**
 * 기도문 본문.
 *
 * 전례문이라 한 글자도 임의로 고칠 수 없다. 여기 실린 본문은 아직 공인 기도서와
 * 한 글자씩 대조하지 않았으므로 전부 `unverified`다. 대조를 마친 기도문만
 * 그 표시를 지운다 — 지우는 것이 곧 "확인했다"는 서명이다.
 *
 * 대조 기준: 한국 천주교 주교회의 『가톨릭 기도서』. 사도신경은 2021년 개정문.
 */

export const PRAYERS: Prayer[] = [
  {
    id: "signum-crucis",
    title: "성호경",
    latin: "Signum Crucis",
    category: "기본",
    level: 1,
    lines: ["성부와 성자와 성령의 이름으로. 아멘."],
    source: "가톨릭 기도서",
    unverified: true,
  },
  {
    id: "gloria-patri",
    title: "영광송",
    latin: "Gloria Patri",
    category: "기본",
    level: 2,
    lines: ["영광이 성부와 성자와 성령께", "처음과 같이 이제와 항상 영원히. 아멘."],
    source: "가톨릭 기도서",
    unverified: true,
  },
  {
    id: "ave-maria",
    title: "성모송",
    latin: "Ave Maria",
    category: "기본",
    level: 3,
    lines: [
      "은총이 가득하신 마리아님, 기뻐하소서!",
      "주님께서 함께 계시니",
      "여인 중에 복되시며 태중의 아들 예수님 또한 복되시나이다.",
      "천주의 성모 마리아님,",
      "이제와 저희 죽을 때에 저희 죄인을 위하여 빌어 주소서. 아멘.",
    ],
    source: "가톨릭 기도서",
    unverified: true,
  },
  {
    id: "pater-noster",
    title: "주님의 기도",
    latin: "Pater Noster",
    category: "기본",
    level: 4,
    lines: [
      "하늘에 계신 우리 아버지,",
      "아버지의 이름이 거룩히 빛나시며",
      "아버지의 나라가 오시며",
      "아버지의 뜻이 하늘에서와 같이 땅에서도 이루어지소서.",
      "오늘 저희에게 일용할 양식을 주시고",
      "저희에게 잘못한 이를 저희가 용서하오니",
      "저희 죄를 용서하시고",
      "저희를 유혹에 빠지지 않게 하시고",
      "악에서 구하소서. 아멘.",
    ],
    source: "가톨릭 기도서",
    unverified: true,
  },
  {
    id: "credo-apostolicum",
    title: "사도신경",
    latin: "Symbolum Apostolicum",
    category: "기본",
    level: 5,
    lines: [
      "전능하신 천주 성부",
      "천지의 창조주를 저는 믿나이다.",
      "그 외아들 우리 주 예수 그리스도님",
      "성령으로 인하여 동정 마리아께 잉태되어 나시고",
      "본시오 빌라도 통치 아래서 고난을 받으시고",
      "십자가에 못 박혀 돌아가시고 묻히셨으며",
      "저승에 가시어 사흗날에 죽은 이들 가운데서 부활하시고",
      "하늘에 오르시어 전능하신 천주 성부 오른편에 앉으시며",
      "그리로부터 산 이와 죽은 이를 심판하러 오시리라 믿나이다.",
      "성령을 믿으며",
      "거룩하고 보편된 교회와 모든 성인의 통공을 믿으며",
      "죄의 용서와 육신의 부활을 믿으며",
      "영원한 삶을 믿나이다. 아멘.",
    ],
    source: "가톨릭 기도서 (2021년 개정)",
    unverified: true,
    note: "2021년에 '그 외아들 우리 주 예수 그리스도님'을 비롯해 여러 구절이 바뀌었다. 옛 본문과 섞이지 않도록 주의.",
  },
];

/**
 * 묵주기도 한 단. 구조가 맞는지 보려고 먼저 하나만 둔다.
 *
 * 다섯 단을 채우고 환희·빛·고통·영광의 신비를 나누는 일은 신비 제목 데이터가
 * 갖춰진 뒤에 한다.
 */
export const PRAYER_SETS: PrayerSet[] = [
  {
    id: "rosarium-decas",
    title: "묵주기도 한 단",
    latin: "Rosarium",
    category: "묵주",
    level: 6,
    steps: [
      { prayerId: "pater-noster", repeat: 1 },
      { prayerId: "ave-maria", repeat: 10 },
      { prayerId: "gloria-patri", repeat: 1 },
    ],
    source: "가톨릭 기도서",
    unverified: true,
    note: "신비 제목은 아직 없다. 넣을 때 각 단계의 label로 붙인다.",
  },
];
