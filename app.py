from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from streamlit_autorefresh import st_autorefresh

DATA_PATH = Path(__file__).parent / "public" / "full_prediction.json"
REALTIME_KOSPI_URL = "https://m.stock.naver.com/api/index/KOSPI/price"


@st.cache_data(show_spinner=False)
def load_prediction_data(path: Path):
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    history = pd.DataFrame(data.get("history", []))
    forecast = pd.DataFrame(data.get("forecast", []))

    for df in (history, forecast):
        if not df.empty and "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce")

    history = history.dropna(subset=["date"]).copy()
    forecast = forecast.dropna(subset=["date"]).copy()

    for col in ["actual", "forecast", "lower68", "upper68", "lower95", "upper95"]:
        if col in history.columns:
            history[col] = pd.to_numeric(history[col], errors="coerce")
        if col in forecast.columns:
            forecast[col] = pd.to_numeric(forecast[col], errors="coerce")

    return data, history, forecast


def signed(value: float) -> str:
    return f"{value:+,.2f}"


def _to_float(value: str | int | float | None) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    return float(str(value).replace(",", ""))


@st.cache_data(show_spinner=False, ttl=15)
def load_realtime_kospi_quote():
    req = Request(
        REALTIME_KOSPI_URL,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None

    if not isinstance(payload, list) or not payload:
        return None

    latest = payload[0]
    return {
        "current_price": _to_float(latest.get("closePrice")),
        "daily_change": _to_float(latest.get("compareToPreviousClosePrice")),
        "daily_pct": _to_float(latest.get("fluctuationsRatio")),
        "local_traded_at": latest.get("localTradedAt"),
        "source": "Naver Index API",
    }


def build_price_chart(history: pd.DataFrame, forecast: pd.DataFrame) -> go.Figure:
    fig = go.Figure()

    if not forecast.empty and {"upper95", "lower95"}.issubset(forecast.columns):
        fig.add_trace(
            go.Scatter(
                x=forecast["date"],
                y=forecast["upper95"],
                mode="lines",
                line=dict(width=0),
                showlegend=False,
                hoverinfo="skip",
            )
        )
        fig.add_trace(
            go.Scatter(
                x=forecast["date"],
                y=forecast["lower95"],
                mode="lines",
                line=dict(width=0),
                fill="tonexty",
                fillcolor="rgba(59,130,246,0.14)",
                name="95% 신뢰구간",
                hovertemplate="%{x|%Y-%m-%d}<br>95%% 하단: %{y:,.1f}<extra></extra>",
            )
        )

    if not forecast.empty and {"upper68", "lower68"}.issubset(forecast.columns):
        fig.add_trace(
            go.Scatter(
                x=forecast["date"],
                y=forecast["upper68"],
                mode="lines",
                line=dict(width=0),
                showlegend=False,
                hoverinfo="skip",
            )
        )
        fig.add_trace(
            go.Scatter(
                x=forecast["date"],
                y=forecast["lower68"],
                mode="lines",
                line=dict(width=0),
                fill="tonexty",
                fillcolor="rgba(59,130,246,0.24)",
                name="68% 신뢰구간",
                hovertemplate="%{x|%Y-%m-%d}<br>68%% 하단: %{y:,.1f}<extra></extra>",
            )
        )

    if not history.empty and "actual" in history.columns:
        fig.add_trace(
            go.Scatter(
                x=history["date"],
                y=history["actual"],
                mode="lines",
                line=dict(color="#111827", width=2),
                name="실제 종가",
                hovertemplate="%{x|%Y-%m-%d}<br>실제: %{y:,.1f}<extra></extra>",
            )
        )

    if not forecast.empty and "forecast" in forecast.columns:
        fig.add_trace(
            go.Scatter(
                x=forecast["date"],
                y=forecast["forecast"],
                mode="lines+markers",
                line=dict(color="#2563eb", width=2, dash="dash"),
                marker=dict(size=5),
                name="예측값",
                hovertemplate="%{x|%Y-%m-%d}<br>예측: %{y:,.1f}<extra></extra>",
            )
        )

    fig.update_layout(
        margin=dict(l=10, r=10, t=10, b=10),
        legend=dict(orientation="h", y=1.02, x=0),
        xaxis_title="날짜",
        yaxis_title="KOSPI",
        hovermode="x unified",
        template="plotly_white",
    )
    return fig


def app() -> None:
    st.set_page_config(page_title="KOSPI TRFM Forecast", layout="wide")

    now = datetime.now()
    next_minute = (now + timedelta(minutes=1)).replace(second=0, microsecond=0)
    ms_to_next_minute = max(1000, int((next_minute - now).total_seconds() * 1000))
    st_autorefresh(interval=ms_to_next_minute, key="kospi_minute_boundary_refresh")

    st.title("KOSPI TRFM Forecast Dashboard")
    if st.button("현재가 새로고침"):
        load_realtime_kospi_quote.clear()
        st.rerun()
    st.caption("현재가는 매 분 00초에 자동 갱신됩니다.")

    if not DATA_PATH.exists():
        st.error(f"데이터 파일을 찾을 수 없습니다: {DATA_PATH}")
        st.stop()

    data, history, forecast = load_prediction_data(DATA_PATH)

    current_price = float(data.get("current_price", 0))
    daily_change = float(data.get("daily_change", 0))
    daily_pct = float(data.get("daily_pct", 0))
    confidence = float(data.get("model_confidence", {}).get("overall", 0))
    last_update = data.get("last_update")

    if last_update:
        try:
            parsed_dt = datetime.fromisoformat(last_update)
            st.caption(f"마지막 업데이트: {parsed_dt:%Y-%m-%d %H:%M:%S}")
        except ValueError:
            st.caption(f"마지막 업데이트: {last_update}")

    realtime_quote = load_realtime_kospi_quote()
    if realtime_quote:
        current_price = float(realtime_quote["current_price"])
        daily_change = float(realtime_quote["daily_change"])
        daily_pct = float(realtime_quote["daily_pct"])
        traded_at = realtime_quote.get("local_traded_at")
        if traded_at:
            st.caption(f"실시간 현재가 기준일: {traded_at} (source: {realtime_quote['source']})")
    else:
        st.caption("실시간 현재가 조회 실패: 마지막 예측 데이터 값을 표시합니다.")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("현재 KOSPI", f"{current_price:,.2f}")
    c2.metric("일간 변동", signed(daily_change))
    c3.metric("일간 수익률", f"{daily_pct:+.2f}%")
    c4.metric("모델 신뢰도", f"{confidence * 100:.1f}%")

    window = st.selectbox(
        "히스토리 표시 범위",
        [90, 180, 365, 730, "전체"],
        index=1,
    )

    if isinstance(window, int) and not history.empty:
        history_view = history.tail(window)
    else:
        history_view = history

    fig = build_price_chart(history_view, forecast)
    st.plotly_chart(fig, use_container_width=True)

    left, right = st.columns([1, 1])

    with left:
        st.subheader("시장 국면(Regime)")
        regime = data.get("regime", {})
        st.write(f"현재 상태: **{regime.get('current', 'N/A')}**")

        probs = regime.get("probabilities", {})
        if probs:
            prob_df = pd.DataFrame(
                [{"상태": k, "확률": float(v)} for k, v in probs.items()]
            ).sort_values("확률", ascending=False)
            prob_df["확률(%)"] = (prob_df["확률"] * 100).round(1)
            st.dataframe(
                prob_df[["상태", "확률(%)"]],
                use_container_width=True,
                hide_index=True,
            )

        st.subheader("핵심 드라이버")
        drivers = data.get("key_drivers", [])
        if drivers:
            ddf = pd.DataFrame(drivers)
            ddf["attribution"] = pd.to_numeric(ddf["attribution"], errors="coerce").fillna(0)
            ddf["영향도(%)"] = (ddf["attribution"] * 100).round(1)
            st.bar_chart(ddf.set_index("feature")["영향도(%)"])

    with right:
        st.subheader("마일스톤")
        milestones = data.get("key_milestones", {})
        rows = []
        for horizon, values in milestones.items():
            rows.append(
                {
                    "구간": horizon,
                    "예상 지수": float(values.get("price", 0)),
                    "변화율(%)": float(values.get("change_pct", 0)),
                    "불확실성": float(values.get("uncertainty", 0)),
                }
            )
        if rows:
            mdf = pd.DataFrame(rows)
            st.dataframe(mdf, use_container_width=True, hide_index=True)

        st.subheader("단기 예측 포인트")
        if not forecast.empty:
            preview = forecast.copy()
            preview["date"] = preview["date"].dt.strftime("%Y-%m-%d")
            st.dataframe(
                preview[["date", "forecast", "lower68", "upper68", "lower95", "upper95"]],
                use_container_width=True,
                hide_index=True,
            )

    with st.expander("원본 JSON 보기"):
        st.json(data)


if __name__ == "__main__":
    app()
