// ─────────────────────────────────────────────────────────────────────────────
// CODED TAROT — 78장 타로 카드 데이터
// ID 0~21: Major Arcana / ID 22~77: Minor Arcana (Wands, Cups, Swords, Pentacles)
// ─────────────────────────────────────────────────────────────────────────────

export type TarotCard = {
  id: number;
  name: string;
  nameKo: string;
  uprightKeywords: string[];
  reversedKeywords: string[];
};

const MAJOR_ARCANA: TarotCard[] = [
  { id: 0,  name: 'The Fool',         nameKo: '바보',         uprightKeywords: ['새로운 시작', '순수함', '모험', '잠재력'], reversedKeywords: ['무모함', '경솔함', '위험', '방황'] },
  { id: 1,  name: 'The Magician',     nameKo: '마법사',       uprightKeywords: ['의지력', '기술', '집중', '창조'], reversedKeywords: ['교활함', '자원 낭비', '조작', '미완성'] },
  { id: 2,  name: 'The High Priestess', nameKo: '여사제',    uprightKeywords: ['직관', '내면의 지혜', '신비', '잠재의식'], reversedKeywords: ['억압된 직관', '비밀', '표면적 지식', '혼란'] },
  { id: 3,  name: 'The Empress',      nameKo: '여황제',       uprightKeywords: ['풍요', '모성', '창조력', '자연'], reversedKeywords: ['의존성', '창조 막힘', '과보호', '결핍'] },
  { id: 4,  name: 'The Emperor',      nameKo: '황제',         uprightKeywords: ['권위', '안정', '질서', '아버지'], reversedKeywords: ['독재', '경직', '통제 상실', '미성숙'] },
  { id: 5,  name: 'The Hierophant',   nameKo: '교황',         uprightKeywords: ['전통', '신념', '제도', '가르침'], reversedKeywords: ['반항', '구속', '편견', '독단'] },
  { id: 6,  name: 'The Lovers',       nameKo: '연인',         uprightKeywords: ['사랑', '조화', '선택', '가치'], reversedKeywords: ['불화', '잘못된 선택', '내면 갈등', '부조화'] },
  { id: 7,  name: 'The Chariot',      nameKo: '전차',         uprightKeywords: ['승리', '의지', '자제력', '전진'], reversedKeywords: ['방향 상실', '공격성', '자제력 부족', '패배'] },
  { id: 8,  name: 'Strength',         nameKo: '힘',           uprightKeywords: ['용기', '인내', '내면의 힘', '자제'], reversedKeywords: ['자기 의심', '나약함', '억압된 감정', '두려움'] },
  { id: 9,  name: 'The Hermit',       nameKo: '은둔자',       uprightKeywords: ['고독', '내면 탐구', '지혜', '성찰'], reversedKeywords: ['고립', '편집증', '방황', '내면 거부'] },
  { id: 10, name: 'Wheel of Fortune', nameKo: '운명의 수레바퀴', uprightKeywords: ['변화', '행운', '순환', '전환점'], reversedKeywords: ['불운', '저항', '통제 불능', '정체'] },
  { id: 11, name: 'Justice',          nameKo: '정의',         uprightKeywords: ['공정', '진실', '균형', '결과'], reversedKeywords: ['불공정', '회피', '불균형', '편향'] },
  { id: 12, name: 'The Hanged Man',   nameKo: '매달린 남자',  uprightKeywords: ['희생', '기다림', '다른 시각', '내려놓음'], reversedKeywords: ['지연', '저항', '순교', '고집'] },
  { id: 13, name: 'Death',            nameKo: '죽음',         uprightKeywords: ['변환', '끝과 시작', '해방', '전환'], reversedKeywords: ['저항', '두려움', '정체', '변화 거부'] },
  { id: 14, name: 'Temperance',       nameKo: '절제',         uprightKeywords: ['균형', '인내', '통합', '조화'], reversedKeywords: ['불균형', '극단', '과잉', '조급함'] },
  { id: 15, name: 'The Devil',        nameKo: '악마',         uprightKeywords: ['집착', '속박', '그림자', '욕망'], reversedKeywords: ['해방', '속박 끊기', '자각', '회복'] },
  { id: 16, name: 'The Tower',        nameKo: '탑',           uprightKeywords: ['갑작스러운 변화', '붕괴', '계시', '혼돈'], reversedKeywords: ['재앙 회피', '두려움', '변화 저항', '억압된 혼돈'] },
  { id: 17, name: 'The Star',         nameKo: '별',           uprightKeywords: ['희망', '영감', '치유', '평온'], reversedKeywords: ['절망', '믿음 부족', '실망', '환상'] },
  { id: 18, name: 'The Moon',         nameKo: '달',           uprightKeywords: ['환상', '두려움', '무의식', '불확실'], reversedKeywords: ['혼란 해소', '억압된 두려움 표출', '거짓 드러남', '명료함'] },
  { id: 19, name: 'The Sun',          nameKo: '태양',         uprightKeywords: ['성공', '활력', '기쁨', '명료함'], reversedKeywords: ['우울', '과신', '에너지 저하', '일시적 기쁨'] },
  { id: 20, name: 'Judgement',        nameKo: '심판',         uprightKeywords: ['재탄생', '용서', '깨달음', '소명'], reversedKeywords: ['자기 의심', '과거 집착', '자책', '판단 회피'] },
  { id: 21, name: 'The World',        nameKo: '세계',         uprightKeywords: ['완성', '통합', '성취', '여행'], reversedKeywords: ['미완성', '지연', '단절', '목표 미달'] },
];

// Minor Arcana — Wands (22~35): 불, 열정, 창조
const WANDS: TarotCard[] = [
  { id: 22, name: 'Ace of Wands',     nameKo: '완드 에이스', uprightKeywords: ['새로운 시작', '영감', '열정', '기회'], reversedKeywords: ['방향 상실', '지연', '창조 막힘', '에너지 낭비'] },
  { id: 23, name: 'Two of Wands',     nameKo: '완드 2',      uprightKeywords: ['계획', '비전', '가능성', '기다림'], reversedKeywords: ['두려움', '우유부단', '계획 실패', '좁은 시야'] },
  { id: 24, name: 'Three of Wands',   nameKo: '완드 3',      uprightKeywords: ['확장', '선견지명', '기회', '전진'], reversedKeywords: ['지연', '장애물', '실망', '귀환'] },
  { id: 25, name: 'Four of Wands',    nameKo: '완드 4',      uprightKeywords: ['축하', '안정', '성취', '귀향'], reversedKeywords: ['불안정한 축하', '갈등', '미루기', '부조화'] },
  { id: 26, name: 'Five of Wands',    nameKo: '완드 5',      uprightKeywords: ['경쟁', '갈등', '도전', '긴장'], reversedKeywords: ['회피', '내면 갈등', '타협', '긴장 해소'] },
  { id: 27, name: 'Six of Wands',     nameKo: '완드 6',      uprightKeywords: ['승리', '인정', '자신감', '성공'], reversedKeywords: ['자만', '인정 결핍', '실패', '불안감'] },
  { id: 28, name: 'Seven of Wands',   nameKo: '완드 7',      uprightKeywords: ['방어', '도전', '끈기', '입장 고수'], reversedKeywords: ['지침', '포기', '압도됨', '두려움'] },
  { id: 29, name: 'Eight of Wands',   nameKo: '완드 8',      uprightKeywords: ['신속함', '행동', '진전', '소식'], reversedKeywords: ['지연', '좌절', '혼란', '소통 문제'] },
  { id: 30, name: 'Nine of Wands',    nameKo: '완드 9',      uprightKeywords: ['인내', '회복력', '마지막 시험', '지구력'], reversedKeywords: ['고집', '방어적 태도', '피로', '포기 직전'] },
  { id: 31, name: 'Ten of Wands',     nameKo: '완드 10',     uprightKeywords: ['부담', '책임', '과부하', '도착 직전'], reversedKeywords: ['짐 내려놓기', '방임', '번아웃', '위임'] },
  { id: 32, name: 'Page of Wands',    nameKo: '완드 페이지', uprightKeywords: ['탐험', '호기심', '열정', '새 소식'], reversedKeywords: ['무모함', '경솔함', '에너지 낭비', '방향 없음'] },
  { id: 33, name: 'Knight of Wands',  nameKo: '완드 기사',   uprightKeywords: ['모험', '충동', '열정적 행동', '에너지'], reversedKeywords: ['충동적', '분노', '위험 감수', '집중 부족'] },
  { id: 34, name: 'Queen of Wands',   nameKo: '완드 여왕',   uprightKeywords: ['카리스마', '독립', '자신감', '용기'], reversedKeywords: ['지배적', '복수심', '자기중심', '질투'] },
  { id: 35, name: 'King of Wands',    nameKo: '완드 왕',     uprightKeywords: ['리더십', '비전', '기업가 정신', '명예'], reversedKeywords: ['독재', '오만', '무모한 지도력', '충동'] },
];

// Minor Arcana — Cups (36~49): 물, 감정, 관계
const CUPS: TarotCard[] = [
  { id: 36, name: 'Ace of Cups',      nameKo: '컵 에이스',   uprightKeywords: ['새로운 감정', '직관', '사랑', '창의성'], reversedKeywords: ['감정 억압', '공허함', '단절', '감정적 차단'] },
  { id: 37, name: 'Two of Cups',      nameKo: '컵 2',        uprightKeywords: ['파트너십', '연결', '상호 감정', '조화'], reversedKeywords: ['불화', '단절', '불균형', '신뢰 파괴'] },
  { id: 38, name: 'Three of Cups',    nameKo: '컵 3',        uprightKeywords: ['축하', '우정', '공동체', '기쁨'], reversedKeywords: ['고립', '과잉', '험담', '삼각관계'] },
  { id: 39, name: 'Four of Cups',     nameKo: '컵 4',        uprightKeywords: ['명상', '무관심', '내면 탐구', '불만족'], reversedKeywords: ['기회 발견', '새 관점', '무기력 탈출', '참여'] },
  { id: 40, name: 'Five of Cups',     nameKo: '컵 5',        uprightKeywords: ['상실', '슬픔', '후회', '실망'], reversedKeywords: ['수용', '회복', '앞으로 나아감', '용서'] },
  { id: 41, name: 'Six of Cups',      nameKo: '컵 6',        uprightKeywords: ['향수', '과거', '순수함', '추억'], reversedKeywords: ['과거 집착', '성숙', '앞으로 이동', '미성숙'] },
  { id: 42, name: 'Seven of Cups',    nameKo: '컵 7',        uprightKeywords: ['환상', '선택', '꿈', '혼란'], reversedKeywords: ['명료함', '방향 설정', '현실 직면', '결정'] },
  { id: 43, name: 'Eight of Cups',    nameKo: '컵 8',        uprightKeywords: ['이탈', '내면 추구', '떠남', '실망'], reversedKeywords: ['표류', '두려움', '현실 도피', '방황'] },
  { id: 44, name: 'Nine of Cups',     nameKo: '컵 9',        uprightKeywords: ['소원 성취', '만족', '풍요', '행복'], reversedKeywords: ['불만족', '물질주의', '무절제', '공허함'] },
  { id: 45, name: 'Ten of Cups',      nameKo: '컵 10',       uprightKeywords: ['행복한 가정', '조화', '충족', '평화'], reversedKeywords: ['불화', '붕괴된 가정', '가치 충돌', '표면적 행복'] },
  { id: 46, name: 'Page of Cups',     nameKo: '컵 페이지',   uprightKeywords: ['감수성', '창의성', '직관적 메시지', '꿈'], reversedKeywords: ['감정적 미성숙', '조작', '감수성 억압', '환상'] },
  { id: 47, name: 'Knight of Cups',   nameKo: '컵 기사',     uprightKeywords: ['낭만', '매력', '이상주의', '감성'], reversedKeywords: ['기분 변덕', '비현실', '실망', '조작'] },
  { id: 48, name: 'Queen of Cups',    nameKo: '컵 여왕',     uprightKeywords: ['공감', '직관', '감정적 안정', '돌봄'], reversedKeywords: ['감정 불안정', '의존성', '자기기만', '과민함'] },
  { id: 49, name: 'King of Cups',     nameKo: '컵 왕',       uprightKeywords: ['감정적 성숙', '균형', '외교', '연민'], reversedKeywords: ['감정 조작', '기분 변덕', '감정 억압', '차가움'] },
];

// Minor Arcana — Swords (50~63): 공기, 사고, 갈등
const SWORDS: TarotCard[] = [
  { id: 50, name: 'Ace of Swords',    nameKo: '소드 에이스', uprightKeywords: ['명료함', '진실', '돌파구', '새로운 관점'], reversedKeywords: ['혼란', '오해', '잔인함', '방향 상실'] },
  { id: 51, name: 'Two of Swords',    nameKo: '소드 2',      uprightKeywords: ['교착', '결정 회피', '균형', '차단'], reversedKeywords: ['정보 과부하', '결정 강요', '진실 드러남', '혼란'] },
  { id: 52, name: 'Three of Swords',  nameKo: '소드 3',      uprightKeywords: ['슬픔', '상처', '배신', '분리'], reversedKeywords: ['치유', '회복', '상처 극복', '용서'] },
  { id: 53, name: 'Four of Swords',   nameKo: '소드 4',      uprightKeywords: ['휴식', '회복', '명상', '후퇴'], reversedKeywords: ['불안', '재활성화', '번아웃', '방치'] },
  { id: 54, name: 'Five of Swords',   nameKo: '소드 5',      uprightKeywords: ['갈등', '패배', '굴욕', '긴장'], reversedKeywords: ['화해', '과거 놓아줌', '결과 수용', '타협'] },
  { id: 55, name: 'Six of Swords',    nameKo: '소드 6',      uprightKeywords: ['전환', '여행', '변화', '도피'], reversedKeywords: ['저항', '막힌 전환', '과거 집착', '지연'] },
  { id: 56, name: 'Seven of Swords',  nameKo: '소드 7',      uprightKeywords: ['기만', '전략', '회피', '비밀'], reversedKeywords: ['자백', '진실 드러남', '양심의 가책', '탈출'] },
  { id: 57, name: 'Eight of Swords',  nameKo: '소드 8',      uprightKeywords: ['제약', '자기 제한', '갇힘', '무기력'], reversedKeywords: ['해방', '자각', '새로운 관점', '제약 극복'] },
  { id: 58, name: 'Nine of Swords',   nameKo: '소드 9',      uprightKeywords: ['불안', '악몽', '두려움', '절망'], reversedKeywords: ['내면의 두려움', '고통 해소', '회복', '진실 수용'] },
  { id: 59, name: 'Ten of Swords',    nameKo: '소드 10',     uprightKeywords: ['배신', '끝', '고통', '최저점'], reversedKeywords: ['회복', '재건', '생존', '저항'] },
  { id: 60, name: 'Page of Swords',   nameKo: '소드 페이지', uprightKeywords: ['호기심', '날카로움', '소통', '경계'], reversedKeywords: ['경솔함', '험담', '분석 마비', '도발'] },
  { id: 61, name: 'Knight of Swords', nameKo: '소드 기사',   uprightKeywords: ['결단력', '행동', '야심', '직접성'], reversedKeywords: ['무모함', '공격성', '경솔', '분산'] },
  { id: 62, name: 'Queen of Swords',  nameKo: '소드 여왕',   uprightKeywords: ['명료함', '독립', '냉정함', '진실'], reversedKeywords: ['냉담함', '복수', '편협함', '잔인함'] },
  { id: 63, name: 'King of Swords',   nameKo: '소드 왕',     uprightKeywords: ['권위', '진실', '명료함', '윤리'], reversedKeywords: ['조작', '독재', '잔인한 판단', '부도덕'] },
];

// Minor Arcana — Pentacles (64~77): 땅, 물질, 현실
const PENTACLES: TarotCard[] = [
  { id: 64, name: 'Ace of Pentacles',    nameKo: '펜타클 에이스', uprightKeywords: ['새로운 기회', '풍요', '번영', '물질적 시작'], reversedKeywords: ['기회 상실', '물질적 결핍', '재정 불안', '탐욕'] },
  { id: 65, name: 'Two of Pentacles',    nameKo: '펜타클 2',      uprightKeywords: ['균형', '적응', '시간 관리', '유연성'], reversedKeywords: ['균형 붕괴', '과부하', '재정 불안', '혼란'] },
  { id: 66, name: 'Three of Pentacles',  nameKo: '펜타클 3',      uprightKeywords: ['협력', '기술', '노력', '성장'], reversedKeywords: ['갈등', '자만', '협력 부재', '평범함'] },
  { id: 67, name: 'Four of Pentacles',   nameKo: '펜타클 4',      uprightKeywords: ['안정', '절약', '통제', '보안'], reversedKeywords: ['인색함', '집착', '물질주의', '과소비'] },
  { id: 68, name: 'Five of Pentacles',   nameKo: '펜타클 5',      uprightKeywords: ['빈곤', '고난', '걱정', '결핍'], reversedKeywords: ['회복', '도움 수용', '고난 극복', '개선'] },
  { id: 69, name: 'Six of Pentacles',    nameKo: '펜타클 6',      uprightKeywords: ['관대함', '나눔', '풍요', '균형'], reversedKeywords: ['불균형', '인색함', '부채', '지배'] },
  { id: 70, name: 'Seven of Pentacles',  nameKo: '펜타클 7',      uprightKeywords: ['평가', '인내', '장기 투자', '수확'], reversedKeywords: ['조급함', '수익 부족', '지속 불가', '포기'] },
  { id: 71, name: 'Eight of Pentacles',  nameKo: '펜타클 8',      uprightKeywords: ['기술 습득', '집중', '근면', '장인정신'], reversedKeywords: ['완벽주의', '반복 작업', '기술 부족', '집중 부재'] },
  { id: 72, name: 'Nine of Pentacles',   nameKo: '펜타클 9',      uprightKeywords: ['독립', '풍요', '자급자족', '성공'], reversedKeywords: ['물질 의존', '사기', '자기 가치 미인식', '고립'] },
  { id: 73, name: 'Ten of Pentacles',    nameKo: '펜타클 10',     uprightKeywords: ['풍요', '유산', '안정', '성취'], reversedKeywords: ['재정 손실', '가족 갈등', '불안정', '빠른 돈'] },
  { id: 74, name: 'Page of Pentacles',   nameKo: '펜타클 페이지', uprightKeywords: ['야망', '새로운 학습', '기회', '집중'], reversedKeywords: ['나태함', '단기적 사고', '무계획', '돈 낭비'] },
  { id: 75, name: 'Knight of Pentacles', nameKo: '펜타클 기사',   uprightKeywords: ['신뢰성', '근면', '인내', '실행'], reversedKeywords: ['정체', '게으름', '완고함', '무기력'] },
  { id: 76, name: 'Queen of Pentacles',  nameKo: '펜타클 여왕',   uprightKeywords: ['실용성', '풍요', '돌봄', '안정'], reversedKeywords: ['재정 불안', '과보호', '자기 방치', '집착'] },
  { id: 77, name: 'King of Pentacles',   nameKo: '펜타클 왕',     uprightKeywords: ['풍요', '안정', '사업 성공', '실용성'], reversedKeywords: ['물질주의', '부패', '탐욕', '관리 실패'] },
];

export const TAROT_DECK: TarotCard[] = [
  ...MAJOR_ARCANA,
  ...WANDS,
  ...CUPS,
  ...SWORDS,
  ...PENTACLES,
];

/** 카드 ID로 카드 데이터 조회 */
export function getCardById(id: number): TarotCard {
  return TAROT_DECK[id] ?? TAROT_DECK[0];
}
