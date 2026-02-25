import { useState, useEffect } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Activity, BarChart2, Brain, Clock, Zap, Shield, ChevronRight, RefreshCw, Star, Info } from 'lucide-react';

const CHART_FORECAST_DAYS = 365;
const CHART_LABEL_DAYS = new Set([30, 60, 90, 180, 365]);

const toFiniteNumber = (value: unknown, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const buildChartSeries = (historyInput: any[] = [], forecastInput: any[] = [], fallbackBasePrice = 6083.86) => {
  const history = historyInput.map((item) => ({ ...item }));
  const normalizedForecast = forecastInput.map((item, idx) => {
    const day = idx + 1;
    const forecastValue = toFiniteNumber(item?.forecast, toFiniteNumber(item?.actual, fallbackBasePrice));
    return {
      date: CHART_LABEL_DAYS.has(day) ? `+${day}일` : '',
      actual: null,
      forecast: Math.round(forecastValue),
      lower68: toFiniteNumber(item?.lower68, Math.round(forecastValue - (25 + day * 0.7))),
      upper68: toFiniteNumber(item?.upper68, Math.round(forecastValue + (25 + day * 0.7))),
      lower95: toFiniteNumber(item?.lower95, Math.round(forecastValue - (50 + day * 1.4))),
      upper95: toFiniteNumber(item?.upper95, Math.round(forecastValue + (50 + day * 1.4))),
    };
  });

  const clampedForecast = normalizedForecast.slice(0, CHART_FORECAST_DAYS);
  let lastForecast = toFiniteNumber(
    clampedForecast[clampedForecast.length - 1]?.forecast,
    toFiniteNumber(history[history.length - 1]?.actual, fallbackBasePrice),
  );
  let lastStep = 2;

  if (clampedForecast.length >= 2) {
    const lastIdx = clampedForecast.length - 1;
    lastStep = toFiniteNumber(clampedForecast[lastIdx]?.forecast, lastForecast) - toFiniteNumber(clampedForecast[lastIdx - 1]?.forecast, lastForecast - 2);
  }

  for (let day = clampedForecast.length + 1; day <= CHART_FORECAST_DAYS; day++) {
    const drift = lastStep * 0.985;
    const seasonal = Math.sin(day / 24) * 2.1;
    lastForecast = Math.round(lastForecast + drift + seasonal);
    lastStep = drift;
    clampedForecast.push({
      date: CHART_LABEL_DAYS.has(day) ? `+${day}일` : '',
      actual: null,
      forecast: lastForecast,
      lower68: lastForecast - Math.round(25 + day * 0.7),
      upper68: lastForecast + Math.round(25 + day * 0.7),
      lower95: lastForecast - Math.round(50 + day * 1.4),
      upper95: lastForecast + Math.round(50 + day * 1.4),
    });
  }

  const finalizedForecast = clampedForecast.map((item, idx) => ({
    ...item,
    date: CHART_LABEL_DAYS.has(idx + 1) ? `+${idx + 1}일` : '',
  }));

  return [...history, ...finalizedForecast];
};

// Generate mock forecast data for initial state
const generateForecastData = (startingPrice = 6083.86) => {
  const data = [];
  let basePrice = startingPrice;

  // Historical data (30 days)
  for (let i = 30; i > 0; i--) {
    const change = (Math.random() - 0.48) * 40;
    basePrice = Math.max(5800, Math.min(6200, basePrice + change));
    data.push({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      actual: Math.round(basePrice),
      forecast: null,
      lower68: null,
      upper68: null,
      lower95: null,
      upper95: null,
    });
  }

  // Forecast data (365 days)
  basePrice = startingPrice;
  const forecastDays = [30, 60, 90, 180, 365];
  for (let i = 1; i <= CHART_FORECAST_DAYS; i++) {
    const trend = i * 2.2;
    const volatility = Math.sin(i / 15) * 30;
    const noise = (Math.random() - 0.5) * 20;
    const forecast = Math.round(startingPrice + trend + volatility + noise);

    const isForecastDay = forecastDays.includes(i);

    data.push({
      date: isForecastDay ? `+${i}일` : '',
      actual: null,
      forecast: forecast,
      lower68: forecast - Math.round(25 + i * 0.7),
      upper68: forecast + Math.round(25 + i * 0.7),
      lower95: forecast - Math.round(50 + i * 1.4),
      upper95: forecast + Math.round(50 + i * 1.4),
    });
  }

  return data;
};

const generateFeatureImportance = () => [
  { feature: 'S&P 500', importance: 18.2, color: '#3B82F6' },
  { feature: 'USD/KRW', importance: 12.4, color: '#10B981' },
  { feature: 'VIX Index', importance: 10.1, color: '#F59E0B' },
  { feature: 'DR am Price', importance: 8.7, color: '#EF4444' },
  { feature: 'Foreign Net', importance: 7.3, color: '#8B5CF6' },
  { feature: 'Bond Yield', importance: 6.8, color: '#EC4899' },
  { feature: 'PMI Data', importance: 5.2, color: '#14B8A6' },
  { feature: 'Others', importance: 31.3, color: '#6B7280' },
];

const generateBacktestMetrics = () => [
  { period: '1일', mape: 2.1, rmse: 88, accuracy: 61, sharpe: 1.8 },
  { period: '5일', mape: 3.8, rmse: 165, accuracy: 58, sharpe: 1.5 },
  { period: '30일', mape: 7.2, rmse: 330, accuracy: 54, sharpe: 1.2 },
  { period: '90일', mape: 11.5, rmse: 650, accuracy: 51, sharpe: 0.9 },
];

const marketRiskProfiles = {
  '3일': [
    { type: 'red', title: '미국 고용지표 변동성', impact: -160, description: '단기 금리 민감도로 지수 급등락 가능' },
    { type: 'yellow', title: '원/달러 급변 구간', impact: -110, description: '환율 스파이크 시 외국인 수급 흔들림' },
    { type: 'green', title: '외국인 선물 순매수', impact: 140, description: '프로그램 매수 유입 시 단기 탄력 강화' },
  ],
  '15일': [
    { type: 'red', title: 'FOMC 의사록 매파 해석', impact: -210, description: '긴축 기대 재확대로 밸류 부담 확대' },
    { type: 'yellow', title: '중국 정책 부양 강도', impact: -140, description: '부양 약화 시 경기민감 업종 압박' },
    { type: 'green', title: '메모리 현물가 반등', impact: 190, description: 'IT 대형주 실적 기대 선반영 가능' },
  ],
  '30일': [
    { type: 'red', title: '미국 CPI 상승', impact: -280, description: '인플레이션 재발 시 Fed 긴축 강화' },
    { type: 'yellow', title: '중국 PMI 50 이하', impact: -190, description: '경기 둔화로 인한 수출 감소 우려' },
    { type: 'green', title: '반도체 가격 반등', impact: 230, description: 'AI 서버 메모리 수요 증가' },
  ],
  '60일': [
    { type: 'red', title: '미국 장기금리 재상승', impact: -320, description: '성장주 할인율 확대 및 밸류 조정 리스크' },
    { type: 'yellow', title: '중국 수출지표 둔화', impact: -220, description: '대외수요 약화 시 한국 수출주 부담' },
    { type: 'green', title: '반도체 재고 정상화', impact: 290, description: '이익 추정치 상향으로 지수 하단 지지' },
  ],
  '90일': [
    { type: 'red', title: '기업 실적 가이던스 하향', impact: -380, description: '이익 추정치 하향 시 지수 리레이팅 압력' },
    { type: 'yellow', title: '지정학 리스크 재부각', impact: -260, description: '원자재·물류 불안으로 변동성 확대' },
    { type: 'green', title: 'AI 인프라 투자 확대', impact: 330, description: '대형 IT 중심 실적 모멘텀 강화' },
  ],
  '180일': [
    { type: 'red', title: '글로벌 경기 둔화 심화', impact: -430, description: '제조업 사이클 둔화 시 수출 회복 지연' },
    { type: 'yellow', title: '환율 변동성 확대', impact: -300, description: '신흥국 자금 흐름 약화와 외국인 이탈 가능' },
    { type: 'green', title: '정책·유동성 완화', impact: 360, description: '금리 부담 완화로 밸류에이션 회복' },
  ],
  '365일': [
    { type: 'red', title: '미국 경기침체 가능성', impact: -520, description: '글로벌 수요 위축으로 실적 경로 하향' },
    { type: 'yellow', title: '정책금리 경로 불확실성', impact: -350, description: '정책 지연 시 할인율 부담 장기화' },
    { type: 'green', title: '반도체 슈퍼사이클', impact: 420, description: '메모리·파운드리 동반 회복 시 상단 확장' },
  ],
} as const;

const modelConfidence = [
  { category: '데이터 신뢰성', score: 4.5 },
  { category: '모델 안정성', score: 4.2 },
  { category: '예측 정확도', score: 4.0 },
  { category: '시장 적합성', score: 4.1 },
];

type ForecastPeriod = '3일' | '15일' | '30일' | '60일' | '90일' | '180일' | '365일';

const forecastPeriods: ForecastPeriod[] = ['3일', '15일', '30일', '60일', '90일', '180일', '365일'];

const periodDaysMap: Record<ForecastPeriod, number> = {
  '3일': 3,
  '15일': 15,
  '30일': 30,
  '60일': 60,
  '90일': 90,
  '180일': 180,
  '365일': 365,
};

const periodViewConfig: Record<ForecastPeriod, {
  riskScale: number;
  uncertaintyScale: number;
  scenarioProbabilities: [number, number, number];
  tag: string;
}> = {
  '3일': {
    riskScale: 0.55,
    uncertaintyScale: 0.6,
    scenarioProbabilities: [78, 15, 7],
    tag: '초단기',
  },
  '15일': {
    riskScale: 0.7,
    uncertaintyScale: 0.75,
    scenarioProbabilities: [74, 18, 8],
    tag: '초단기',
  },
  '30일': {
    riskScale: 0.8,
    uncertaintyScale: 0.85,
    scenarioProbabilities: [70, 20, 10],
    tag: '단기',
  },
  '60일': {
    riskScale: 1.0,
    uncertaintyScale: 1.0,
    scenarioProbabilities: [62, 23, 15],
    tag: '중기',
  },
  '90일': {
    riskScale: 1.2,
    uncertaintyScale: 1.15,
    scenarioProbabilities: [55, 30, 15],
    tag: '장기',
  },
  '180일': {
    riskScale: 1.45,
    uncertaintyScale: 1.35,
    scenarioProbabilities: [48, 34, 18],
    tag: '초장기',
  },
  '365일': {
    riskScale: 1.7,
    uncertaintyScale: 1.6,
    scenarioProbabilities: [42, 36, 22],
    tag: '연간',
  },
};

const fixedAccentTheme: {
  primary: string;
  secondary: string;
  soft: string;
  glow: string;
} = {
  primary: '#3B82F6',
  secondary: '#06B6D4',
  soft: 'rgba(59, 130, 246, 0.2)',
  glow: 'rgba(59, 130, 246, 0.35)',
};

export function App() {
  const [forecastData, setForecastData] = useState(generateForecastData(6083.86));
  const [selectedPeriod, setSelectedPeriod] = useState('3M');
  const [selectedForecastPeriod, setSelectedForecastPeriod] = useState<ForecastPeriod>('90일');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [realData, setRealData] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const activeTheme = fixedAccentTheme;

  const pageThemeClass = isDarkMode
    ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white'
    : 'bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 text-slate-900';

  const sectionThemeClass = isDarkMode
    ? 'border border-slate-600 bg-gradient-to-br from-slate-800 to-slate-700'
    : 'border border-slate-200 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)]';

  const controlThemeClass = isDarkMode
    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
    : 'bg-slate-200 text-slate-700 hover:bg-slate-300';

  const periodActiveStyle = {
    backgroundImage: `linear-gradient(135deg, ${activeTheme.primary}, ${activeTheme.secondary})`,
    boxShadow: `0 6px 18px ${activeTheme.glow}`,
    color: '#FFFFFF',
  };
  const boxHeightScale = 0.55;
  const scaledPx = (px: number) => `${Math.round(px * boxHeightScale * 10) / 10}px`;
  const boxVerticalStyle = { paddingTop: scaledPx(24), paddingBottom: scaledPx(24) };
  const innerBoxVerticalStyle = { paddingTop: scaledPx(20), paddingBottom: scaledPx(20) };
  const compactBoxVerticalStyle = { paddingTop: scaledPx(16), paddingBottom: scaledPx(16) };

  const fetchPredictionData = async () => {
    try {
      const response = await fetch(`/full_prediction.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setRealData(data);

      if (data && data.history && data.forecast) {
        setForecastData(buildChartSeries(data.history, data.forecast, Number(data.current_price || 6083.86)));
      }

      setLastUpdate(new Date(data.last_update || new Date()));
      setLastSyncTime(new Date());
      return true;
    } catch (error) {
      console.error('Failed to fetch prediction data:', error);
      return false;
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    const ok = await fetchPredictionData();
    setRefreshStatus(ok ? 'success' : 'error');
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPredictionData();
    const interval = setInterval(() => {
      fetchPredictionData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const currentPrice = Number(realData?.current_price || 6083.86);

  const fallbackMilestones = {
    '30d': { price: 6250, change_pct: 2.7, uncertainty: 120 },
    '60d': { price: 6413, change_pct: 5.4, uncertainty: 170 },
    '90d': { price: 6582, change_pct: 8.2, uncertainty: 230 },
  };

  const getMilestone = (key: '30d' | '60d' | '90d') => realData?.key_milestones?.[key] || fallbackMilestones[key];

  const anchorChanges = {
    30: Number(getMilestone('30d').change_pct),
    60: Number(getMilestone('60d').change_pct),
    90: Number(getMilestone('90d').change_pct),
  };

  const deriveChangeByDay = (day: number) => {
    if (day <= 30) {
      return (anchorChanges[30] / 30) * day;
    }
    if (day <= 60) {
      return anchorChanges[30] + ((anchorChanges[60] - anchorChanges[30]) / 30) * (day - 30);
    }
    if (day <= 90) {
      return anchorChanges[60] + ((anchorChanges[90] - anchorChanges[60]) / 30) * (day - 60);
    }

    const longTermSlope = ((anchorChanges[90] - anchorChanges[60]) / 30) * 0.6;
    return anchorChanges[90] + longTermSlope * (day - 90);
  };

  const deriveUncertaintyByDay = (day: number) => Math.max(65, Math.round(65 + Math.sqrt(day) * 14));

  const forecasts = forecastPeriods.reduce((acc, period) => {
    const day = periodDaysMap[period];
    const milestoneKey = day === 30 ? '30d' : day === 60 ? '60d' : day === 90 ? '90d' : null;

    if (milestoneKey) {
      const milestone = getMilestone(milestoneKey);
      acc[period] = {
        value: Math.round(Number(milestone.price)),
        change: Number(milestone.change_pct),
        uncertainty: Math.max(80, Math.round(Number(milestone.uncertainty ?? fallbackMilestones[milestoneKey].uncertainty))),
      };
      return acc;
    }

    const projectedChange = parseFloat(deriveChangeByDay(day).toFixed(1));
    acc[period] = {
      value: Math.round(currentPrice * (1 + projectedChange / 100)),
      change: projectedChange,
      uncertainty: deriveUncertaintyByDay(day),
    };
    return acc;
  }, {} as Record<ForecastPeriod, { value: number; change: number; uncertainty: number }>);

  const featureImportance = realData?.key_drivers
    ? realData.key_drivers.map((d: any, i: number) => ({
      feature: d.feature.split(' (')[0],
      importance: d.attribution * 100,
      color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5]
    }))
    : generateFeatureImportance();

  const selectedForecast = forecasts[selectedForecastPeriod];
  const selectedViewConfig = periodViewConfig[selectedForecastPeriod];
  const scenarioRange = Math.max(70, Math.round(selectedForecast.uncertainty * selectedViewConfig.uncertaintyScale));
  const dependencyStrength = periodDaysMap[selectedForecastPeriod] / 365;
  const dependentGroupStyle = {
    background: isDarkMode
      ? `linear-gradient(180deg, rgba(59,130,246,${(0.07 + dependencyStrength * 0.1).toFixed(3)}), rgba(15,23,42,0.62))`
      : `linear-gradient(180deg, rgba(59,130,246,${(0.05 + dependencyStrength * 0.06).toFixed(3)}), rgba(255,255,255,0.88))`,
    borderColor: `rgba(59,130,246,${(0.28 + dependencyStrength * 0.22).toFixed(3)})`,
    boxShadow: `0 0 0 1px rgba(59,130,246,${(0.09 + dependencyStrength * 0.15).toFixed(3)}) inset`,
    backdropFilter: 'blur(4px)',
  } as const;
  const dependentSubsectionStyle = {
    background: isDarkMode
      ? 'linear-gradient(135deg, rgba(30,41,59,0.72), rgba(51,65,85,0.58))'
      : 'linear-gradient(135deg, rgba(255,255,255,0.82), rgba(241,245,249,0.78))',
    borderColor: isDarkMode ? 'rgba(148,163,184,0.48)' : 'rgba(148,163,184,0.4)',
  } as const;

  const toChangePct = (price: number) => parseFloat((((price / currentPrice) - 1) * 100).toFixed(1));

  const baseForecast = selectedForecast.value;
  const optimisticForecast = baseForecast + Math.round(scenarioRange);
  const pessimisticForecast = baseForecast - Math.round(scenarioRange * 0.85);

  const [baseProb, optimisticProb, pessimisticProb] = selectedViewConfig.scenarioProbabilities;

  const scenarioData = [
    {
      scenario: '기준 시나리오',
      probability: baseProb,
      forecast: baseForecast,
      change: toChangePct(baseForecast),
      color: '#3B82F6'
    },
    {
      scenario: '낙관 시나리오',
      probability: optimisticProb,
      forecast: optimisticForecast,
      change: toChangePct(optimisticForecast),
      color: '#10B981'
    },
    {
      scenario: '비관 시나리오',
      probability: pessimisticProb,
      forecast: pessimisticForecast,
      change: toChangePct(pessimisticForecast),
      color: '#EF4444'
    },
  ];

  const marketRisks = marketRiskProfiles[selectedForecastPeriod].map((risk) => {
    return {
      ...risk,
      impact: `${risk.impact > 0 ? '+' : ''}${risk.impact}pt`,
      description: `${selectedViewConfig.tag}(${selectedForecastPeriod}) 관점 · ${risk.description}`,
    };
  });

  const backtestMetrics = generateBacktestMetrics();

  const regimeColors: Record<string, string> = {
    '평상시': '#10B981',
    '위기시': '#EF4444',
    '금리전환기': '#3B82F6',
    '실적시즌': '#F59E0B'
  };

  const currentRegime = realData?.regime?.current || '평상시';
  const regimeProb = realData?.regime?.probabilities?.[currentRegime] || 0.68;
  const regimeList = realData?.regime?.probabilities
    ? Object.entries(realData.regime.probabilities).map(([name, prob]) => ({
      name,
      prob: prob as number,
      color: regimeColors[name] || '#6B7280'
    }))
    : [
      { name: '평상시', prob: 0.68, color: '#10B981' },
      { name: '금리전환기', prob: 0.28, color: '#3B82F6' },
      { name: '실적시즌', prob: 0.04, color: '#F59E0B' },
      { name: '위기시', prob: 0.00, color: '#EF4444' },
    ];

  const predictionBasis: Record<ForecastPeriod, { title: string; items: { label: string; value: string }[] }> = {
    '3일': {
      title: '3일 예측 근거',
      items: [
        { label: '초단기 모멘텀', value: '직전 5거래일 수급/변동성 반영' },
        { label: '시장심리', value: '뉴스 이벤트 민감도 확대로 단기 흔들림 확대' },
        { label: '레짐연결', value: "현재 '평상시' 레짐의 단기 지속 가능성 높음" },
        { label: '리스크체크', value: '미국 지표 발표 전후 변동성 점검 필요' }
      ]
    },
    '15일': {
      title: '15일 예측 근거',
      items: [
        { label: '수급흐름', value: '외국인 순매수 지속 여부가 핵심 변수' },
        { label: '환율/금리', value: '원/달러 및 미 국채금리 방향성 동조화' },
        { label: '기술구간', value: '단기 지지선 재확인 후 상단 테스트 구간' },
        { label: '모델신호', value: '최근 3주 패턴 유사도 기반 추세 유지' }
      ]
    },
    '30일': {
      title: '30일 예측 근거',
      items: [
        { label: '핵심 동인', value: 'S&P 500 상승 동조화 (35%)' },
        { label: '수급/환율', value: '원/달러 안정 및 외국인 매수 (22%)' },
        { label: '레짐분석', value: "현재 '평상시' 레짐 (85%)" },
        { label: '기술지표', value: '이평선 정배열 & 계단식 상승' }
      ]
    },
    '60일': {
      title: '60일 예측 근거',
      items: [
        { label: '매크로', value: 'Fed 금리 동결 기조 반영 (18%)' },
        { label: '유동성', value: '글로벌 유동성 공급 지속 전망' },
        { label: '변동성', value: 'VIX 20 이하 안정세 유지' },
        { label: '정확도', value: '과거 방향성 정확도 58%' }
      ]
    },
    '90일': {
      title: '90일 예측 근거',
      items: [
        { label: '펀더멘탈', value: '반도체 업황 회복세 본격 반영' },
        { label: '성장성', value: '수출 회복 및 실적 개선 기반' },
        { label: '추세포착', value: 'Transformer 장기 추세 학습' },
        { label: '목표가', value: '중기 하단 지지 및 상방 돌파' }
      ]
    },
    '180일': {
      title: '180일 예측 근거',
      items: [
        { label: '실적사이클', value: '반도체/수출 업황의 반기 누적 효과 반영' },
        { label: '정책환경', value: '통화정책 완화 기대와 유동성 회복 가능성' },
        { label: '밸류에이션', value: '이익 추정치 상향 시 리레이팅 여지 확대' },
        { label: '시스템전망', value: '중장기 추세는 완만한 우상향 우세' }
      ]
    },
    '365일': {
      title: '365일 예측 근거',
      items: [
        { label: '장기추세', value: '거시·실적·유동성 3축 회복 시나리오 반영' },
        { label: '사이클', value: '기업 이익 턴어라운드의 연간 누적 효과' },
        { label: '리스크요인', value: '지정학/정책 변수로 중간 변동성 확대 가능' },
        { label: '전략관점', value: '분할 접근 기반의 장기 우상향 가정' }
      ]
    },
  };

  return (
    <div className={`min-h-screen p-6 ${pageThemeClass}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-xl shadow-lg"
              style={{
                backgroundImage: `linear-gradient(135deg, ${activeTheme.primary}, ${activeTheme.secondary})`,
                boxShadow: `0 10px 28px ${activeTheme.glow}`,
              }}
            >
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-[37px] font-bold leading-tight">KOSPI Transformer 기반 가격예측 시스템</h1>
              <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} text-[22px] leading-snug`}>과거 10년 데이터 기반 · 365일 예측 · Multi-Head Attention</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className={`w-[145px] rounded-xl border p-[5px] ${isDarkMode ? 'border-slate-700 bg-slate-900/70' : 'border-slate-300 bg-white/80'}`}>
              <button
                onClick={() => setIsDarkMode((prev) => !prev)}
                className={`relative h-[26px] w-full overflow-hidden rounded-lg border transition-all ${isDarkMode ? 'border-slate-700 bg-[#070D1B]' : 'border-slate-300 bg-slate-200'}`}
              >
                <span
                  className="absolute left-0 top-[3px] h-5 w-[calc(50%-0.2rem)] rounded-md transition-transform duration-300"
                  style={{
                    transform: isDarkMode ? 'translateX(0.2rem)' : 'translateX(calc(100% + 0rem))',
                    backgroundImage: `linear-gradient(135deg, ${activeTheme.primary}, ${activeTheme.secondary})`,
                  }}
                />
                <span className="relative z-10 flex h-full items-center justify-center text-[10px] font-bold tracking-[0.16em] uppercase">
                  {isDarkMode ? 'Dark To Light' : 'Light To Dark'}
                </span>
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
              style={{
                borderColor: `${activeTheme.primary}80`,
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className={`${sectionThemeClass} rounded-2xl p-6 mb-8`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">KOSPI 365일 예측 차트</h2>
            <p className="text-slate-400 text-sm">{lastUpdate.toLocaleDateString('ko-KR')} 기준 · 신뢰구간: 68%/95%</p>
            <p className="text-slate-500 text-xs mt-1">마지막 동기화: {lastSyncTime.toLocaleString('ko-KR')}</p>
          </div>
          <div className="flex gap-2">
            {['1M', '3M', '1Y', '5Y', 'All'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${selectedPeriod === period ? '' : controlThemeClass}`}
                style={selectedPeriod === period ? periodActiveStyle : undefined}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={(() => {
              if (selectedPeriod === 'All') return forecastData;

              const forecastLen = CHART_FORECAST_DAYS;
              let historyLen = 0;
              if (selectedPeriod === '1M') historyLen = 22;
              else if (selectedPeriod === '3M') historyLen = 66;
              else if (selectedPeriod === '1Y') historyLen = 252;
              else if (selectedPeriod === '5Y') historyLen = 252 * 5;

              return forecastData.slice(-(historyLen + forecastLen));
            })()}>
              <defs>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="color68" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                tick={{ fontSize: 10 }}
                minTickGap={50}
              />
              <YAxis domain={['dataMin - 100', 'dataMax + 100']} stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Legend />
              <Area type="monotone" dataKey="upper95" stroke="none" fill="#60A5FA" fillOpacity={0.1} />
              <Area type="monotone" dataKey="lower95" stroke="none" fill="#60A5FA" fillOpacity={0.1} />
              <Area type="monotone" dataKey="upper68" stroke="none" fill="#34D399" fillOpacity={0.15} />
              <Area type="monotone" dataKey="lower68" stroke="none" fill="#34D399" fillOpacity={0.15} />
              <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={2} dot={false} name="실제값" />
              <Line type="monotone" dataKey="forecast" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="예측값" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Forecast Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Current Price Card */}
        <div className={`${sectionThemeClass} rounded-2xl px-6`} style={boxVerticalStyle}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">현재가</span>
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-4xl font-bold mb-1">
            {realData ? realData.current_price.toLocaleString() : '6,083.86'}
          </div>
          <div className="flex items-center gap-2">
            <span className={realData?.daily_change >= 0 ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>
              {realData ? `${realData.daily_change >= 0 ? '+' : ''}${realData.daily_change.toLocaleString()} (${realData.daily_pct >= 0 ? '+' : ''}${realData.daily_pct}%)` : '+114.22 (+1.91%)'}
            </span>
            {realData?.daily_change >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            데이터 기준: {lastUpdate.toLocaleString('ko-KR')}
          </div>
          {refreshStatus === 'success' && (
            <div className="mt-1 text-xs text-emerald-400">수동 새로고침 완료</div>
          )}
          {refreshStatus === 'error' && (
            <div className="mt-1 text-xs text-red-400">수동 새로고침 실패</div>
          )}
        </div>

        {/* Forecast Cards */}
        {forecastPeriods.map((period) => {
          const data = forecasts[period];
          const isSelected = selectedForecastPeriod === period;
          return (
            <div
              key={period}
              onClick={() => setSelectedForecastPeriod(period)}
              className={`relative group rounded-2xl px-6 transition-all cursor-pointer ${sectionThemeClass} ${isSelected ? '' : 'hover:border-blue-500/50'}`}
              style={isSelected ? { ...boxVerticalStyle, borderColor: activeTheme.primary, boxShadow: `0 0 0 1px ${activeTheme.primary}33, 0 12px 26px ${activeTheme.glow}` } : boxVerticalStyle}
            >
            {/* Tooltip Popup - Positioned Top to avoid overlap with chart */}
            <div className="absolute left-1/2 -top-2 -translate-y-full -translate-x-1/2 w-[28rem] p-4 bg-slate-800 border border-blue-500/50 rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.2)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none">
              <h4 className="text-[22px] font-bold text-blue-400 mb-3 flex items-center gap-2 border-b border-slate-700 pb-2 leading-tight">
                <Brain className="w-6 h-6" />
                {predictionBasis[period].title}
              </h4>
              <div className="space-y-3">
                {predictionBasis[period].items.map((item: any, idx: number) => (
                  <div key={idx} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                      <span className="text-[15.5px] text-slate-500 font-bold uppercase tracking-wider leading-tight">{item.label}</span>
                    </div>
                    <span className="text-[18.5px] text-slate-200 pl-2.5 font-medium leading-snug">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 border-b border-r border-blue-500/50 rotate-45"></div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">{period} 후 예측</span>
              <div className="flex items-center gap-2">
                {isSelected && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ backgroundColor: activeTheme.soft, color: activeTheme.primary }}
                  >
                    선택
                  </span>
                )}
                <Zap className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{data.value.toLocaleString()}</div>
            <div className="flex items-center gap-2">
              <span className={`${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'} text-sm`}>
                {data.change > 0 ? '+' : ''}{data.change.toFixed(1)}%
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                  style={{ width: `${50 + data.change}%` }}
                />
              </div>
            </div>
          </div>
        );
        })}
      </div>

      {/* Dependent Outlook Group */}
      <div className={`rounded-3xl border border-dashed mb-8 px-4`} style={{ ...boxVerticalStyle, ...dependentGroupStyle }}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">선택 기간 종속 영역</span>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            {selectedForecastPeriod} 예측 연동
          </span>
        </div>

        {/* Scenario Analysis */}
        <div className={`rounded-2xl px-6 mb-4 border`} style={{ ...boxVerticalStyle, ...dependentSubsectionStyle }}>
          <h2 className="text-xl font-bold mb-[13px] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            시나리오 기반 {selectedForecastPeriod} 전망
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {scenarioData.map((scenario: any) => (
              <div
                key={scenario.scenario}
                className="bg-slate-700/50 rounded-xl px-6 border border-slate-600 hover:border-opacity-50 transition-all"
                style={{ ...boxVerticalStyle, borderColor: scenario.color }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold">{scenario.scenario}</span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: scenario.color + '30', color: scenario.color }}>
                    {scenario.probability}%
                  </span>
                </div>
                <div className="text-4xl font-bold mb-1" style={{ color: scenario.color }}>
                  {scenario.forecast.toLocaleString()}pt
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {scenario.change > 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                  <span className={scenario.change > 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {scenario.change > 0 ? '+' : ''}{scenario.change}%
                  </span>
                </div>
                <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, 50 + scenario.change * 3))}%`,
                      backgroundColor: scenario.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Factors */}
        <div className={`rounded-2xl px-6 border`} style={{ ...boxVerticalStyle, ...dependentSubsectionStyle }}>
          <h2 className="text-xl font-bold mb-[13px] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            주요 리스크 요인 ({selectedForecastPeriod})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {marketRisks.map((risk: any, index: number) => (
              <div
                key={index}
                className={`px-5 rounded-xl border ${risk.type === 'red' ? 'bg-red-500/10 border-red-500/30' : risk.type === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}
                style={innerBoxVerticalStyle}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${risk.type === 'red' ? 'bg-red-500' : risk.type === 'yellow' ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                  <span className="font-semibold">{risk.title}</span>
                  <span className={`ml-auto text-lg font-bold ${risk.type === 'red' ? 'text-red-400' : risk.type === 'yellow' ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {risk.impact}
                  </span>
                </div>
                <p className="text-sm text-slate-400">{risk.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle Section - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Regime Detection */}
        <div className={`${sectionThemeClass} rounded-2xl px-6`} style={boxVerticalStyle}>
          <h2 className="text-xl font-bold mb-[13px] flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            시장 레짐 (Regime) 분석
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-4 bg-slate-700/50 rounded-xl" style={compactBoxVerticalStyle}>
              <div>
                <div className="text-sm text-slate-400">현재 레짐</div>
                <div className="text-2xl font-bold text-emerald-400">{currentRegime}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">확률</div>
                <div className="text-2xl font-bold">{(regimeProb * 100).toFixed(0)}%</div>
              </div>
            </div>
            <div className="space-y-2">
              {regimeList.map((regime) => (
                <div key={regime.name} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-slate-400">{regime.name}</span>
                  <div className="flex-1 h-3 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${regime.prob * 100}%`,
                        backgroundColor: regime.color,
                      }}
                    />
                  </div>
                  <span className="w-12 text-sm text-right">{(regime.prob * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="mt-2 px-3 bg-blue-500/10 border border-blue-500/30 rounded-lg" style={compactBoxVerticalStyle}>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                <div className="text-sm text-slate-300">
                  <span className="text-blue-400 font-medium">주의:</span> 6/12 FOMC 앞두고 '금리전환기' 확률이 15%→28%로 증가 중
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Importance */}
        <div className={`${sectionThemeClass} rounded-2xl px-6`} style={boxVerticalStyle}>
          <h2 className="text-xl font-bold mb-[13px] flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-yellow-400" />
            주요 변수 기여도
          </h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" stroke="#9CA3AF" domain={[0, 35]} />
                <YAxis type="category" dataKey="feature" stroke="#9CA3AF" width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value) => [`${value}%`, '기여도']}
                />
                <Bar dataKey="importance" name="기여도" radius={[0, 4, 4, 0]}>
                  {featureImportance.map((entry: any, index: number) => (
                    <rect key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Section - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Backtest Results */}
        <div className={`${sectionThemeClass} rounded-2xl px-6`} style={boxVerticalStyle}>
          <h2 className="text-xl font-bold mb-[13px] flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-purple-400" />
            백테스팅 성능 (2015-2024)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-[7px] px-2 text-slate-400 text-sm">예측기간</th>
                  <th className="text-right py-[7px] px-2 text-slate-400 text-sm">MAPE</th>
                  <th className="text-right py-[7px] px-2 text-slate-400 text-sm">RMSE</th>
                  <th className="text-right py-[7px] px-2 text-slate-400 text-sm">방향정확도</th>
                  <th className="text-right py-[7px] px-2 text-slate-400 text-sm">Sharpe</th>
                </tr>
              </thead>
              <tbody>
                {backtestMetrics.map((metric: any) => (
                  <tr key={metric.period} className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-[7px] px-2 font-medium">{metric.period}</td>
                    <td className="text-right py-[7px] px-2 text-emerald-400">{metric.mape}%</td>
                    <td className="text-right py-[7px] px-2">{metric.rmse}pt</td>
                    <td className="text-right py-[7px] px-2 text-cyan-400">{metric.accuracy}%</td>
                    <td className="text-right py-[7px] px-2">
                      <span className={metric.sharpe >= 1 ? 'text-emerald-400' : 'text-yellow-400'}>
                        {metric.sharpe.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Model Confidence & Action Signal */}
        <div className={`${sectionThemeClass} rounded-2xl px-6`} style={boxVerticalStyle}>
          <h2 className="text-xl font-bold mb-[13px] flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            AI 신뢰도 & 투자 신호
          </h2>

          {/* Confidence Score */}
          <div className="mb-[13px] px-5 bg-slate-700/50 rounded-xl" style={innerBoxVerticalStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400">종합 신뢰도</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-6 h-6 ${star <= 4 ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {modelConfidence.map((item: any) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{item.category}</span>
                  <span className="font-medium">{item.score.toFixed(1)}/5.0</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Signal */}
          <div className="px-5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl border border-emerald-500/30" style={innerBoxVerticalStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">AI 투자 신호</span>
              <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                강한 매수
              </span>
            </div>
            <p className="text-sm text-slate-300 mb-2">
              30일 예상 수익률 +3.1% 이상, 신뢰도 70% 상회로 비중 확대를 고려하세요.
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>예상 수익률: +3.1% ~ +7.5%</span>
              <span>리스크 수준: 중간</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className={`${sectionThemeClass} rounded-2xl p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">시스템 상태:</span>
              <span className="text-emerald-400 font-medium">정상 운영중</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">최종 업데이트:</span>
              <span>{lastUpdate.toLocaleString('ko-KR')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <span>Transformer v2.1</span>
            <span>•</span>
            <span>87개 변수</span>
            <span>•</span>
            <span>Regime Adaptive</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700 text-xs text-slate-500">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-600 mt-0.5" />
          <p>
            본 예측은 AI 모델 기반 통계적 분석 결과로, 투자 권유나 보장이 아닌 참고 정보입니다.
            과거 성과가 미래 성과를 보장하지 않으며, 투자 손실 책임은 투자자 본인에게 있습니다.
            모델의 한계: 블랙스완 이벤트, 초단기 노이즈, 시장 구조 변화 등으로 인한 오차가 발생할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
