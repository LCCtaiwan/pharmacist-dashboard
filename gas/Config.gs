const APP_VERSION = '0.6.0';
const TZ = 'Asia/Taipei';

const SHEETS = {
  COURSES: 'Courses',
  SOURCES: 'Sources',
  SETTINGS: 'Settings'
};

const COURSE_HEADERS = [
  'courseId', 'title', 'category', 'topicTag', 'creditPoints', 'creditStatus',
  'deliveryMode', 'region', 'venue', 'startAt', 'endAt',
  'registrationDeadline', 'fee', 'seatsTotal', 'seatsRemaining',
  'registrationStatus', 'creditApprovalStatus', 'rareStatus', 'rareReason',
  'organizer', 'sourceName', 'sourceUrl', 'firstSeenAt', 'lastSeenAt',
  'lastUpdatedAt', 'notes'
];

const SOURCE_HEADERS = [
  'sourceId', 'name', 'type', 'url', 'enabled', 'priority', 'pollMinutes',
  'lastAttemptAt', 'lastSuccessAt', 'lastError', 'notes'
];

const SETTING_HEADERS = ['key', 'value', 'description'];
const DEFAULT_SETTINGS = [
  ['courseLookbackDays', '0', '保留全部歷史課程；前端可自行篩選已結束課程'],
  ['triggerHours', '6', '自動刷新間隔小時'],
  ['rareDefinition', '專業品質、專業倫理、專業相關法規、感染管制、性別議題', '本工具的稀有學分追蹤定義']
];

const DEFAULT_SOURCES = [
  ['taiwan-pharmacy-society', '台灣藥學會－繼續教育申請', 'html', 'https://www.pharm.org.tw/score/applyList.asp', true, 1, 360, '', '', '', 'GitHub Actions 自動嘗試公開分頁；網站拒絕請求時保留上一版資料'],
  ['mohw-cec', '衛福部繼續教育積分系統', 'manual', 'https://cec.mohw.gov.tw/', true, 1, 1440, '', '', '', '權威課程來源；部分功能需登入'],
  ['national-pharmacists', '中華民國藥師公會全國聯合會線上繼續教育', 'manual', 'https://taiwan-pharma.formosasoft.com/index/login?next=%2Fcourse%2Flatest', true, 1, 1440, '', '', '', '會員課程來源'],
  ['clinical-pharmacy', '台灣臨床藥學會課程查詢', 'manual', 'https://www.tshp.org.tw/ehc-tshp/s/w/edu/teachMst/teachMstB1', true, 2, 720, '', '', '', '公開課程來源；動態頁面'],
  ['taipei-pharmacists', '臺北市藥師公會', 'manual', 'https://www.tpa.org.tw/', true, 2, 720, '', '', '', '公開公告來源'],
  ['taoyuan-pharmacists', '桃園市藥師公會持續教育', 'wordpress_rss', 'https://www.pharmacist.org.tw/category/%E2%9E%AA%E6%8C%81%E7%BA%8C%E6%95%99%E8%82%B2%E5%B0%88%E5%8D%80/%E4%B8%8A%E8%AA%B2%E8%B3%87%E8%A8%8A/%E5%85%AC%E6%9C%83%E6%8C%81%E7%BA%8C%E6%95%99%E8%82%B2/feed/', true, 2, 720, '', '', '', 'RSS 自動匯入課程'],
  ['taichung-pharmacists', '臺中市藥師公會', 'html', 'https://www.tccpa.org.tw/web/index.html', true, 2, 720, '', '', '', 'GitHub Actions 自動解析公開課程公告'],
  ['kaohsiung-pharmacists', '高雄市藥師公會', 'html', 'https://www.kpa.org.tw/', true, 2, 720, '', '', '', 'GitHub Actions 自動解析公開活動公告'],
  ['young-pharmacists', '台灣年輕藥師協會', 'wordpress_rss', 'https://typg.org.tw/feed/', true, 3, 720, '', '', '', 'RSS 自動匯入課程'],
  ['vghtpe-pharmacy', '臺北榮總藥學部年度繼續教育', 'html', 'https://www.vghtpe.gov.tw/pharm/images/sg/Fpage.action?fid=19142&muid=21303', true, 3, 1440, '', '', '', 'GitHub Actions 自動解析公開課表']
];

const RARE_RULES = [
  { category: '感染管制', words: ['感染管制', '感管', '抗藥性', '抗生素管理', '傳染病防治', '愛滋', 'HIV'] },
  { category: '性別議題', words: ['性別', '性平', '多元性別', '性少數', 'LGBT'] },
  { category: '專業倫理', words: ['專業倫理', '醫療倫理', '藥事倫理', '倫理'] },
  { category: '專業相關法規', words: ['專業法規', '相關法規', '藥事法', '管制藥品', '法律', '法規', '法令', '違規'] },
  { category: '專業品質', words: ['專業品質', '醫療品質', '病人安全', '用藥安全', '藥害救濟', '品質管理'] }
];
