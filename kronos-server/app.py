import os
import time
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from model import Kronos, KronosTokenizer, KronosPredictor
    MODEL_AVAILABLE = True
except Exception as e:
    print(f"Warning: Kronos model import error: {e}")
    MODEL_AVAILABLE = False

app = FastAPI(
    title="Kronos Foundation Model Inference API",
    description="High-performance OHLCV Financial Candlestick Foundation Model Server for Trading New Pro",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AVAILABLE_MODELS = {
    "kronos-mini": {
        "name": "Kronos-mini",
        "model_id": "NeoQuasar/Kronos-mini",
        "tokenizer_id": "NeoQuasar/Kronos-Tokenizer-2k",
        "context_length": 2048,
        "params": "4.1M",
        "description": "Lightweight 4.1M K-line Foundation Model (2048 Context)"
    },
    "kronos-small": {
        "name": "Kronos-small",
        "model_id": "NeoQuasar/Kronos-small",
        "tokenizer_id": "NeoQuasar/Kronos-Tokenizer-base",
        "context_length": 512,
        "params": "24.7M",
        "description": "Balanced 24.7M K-line Foundation Model (512 Context)"
    },
    "kronos-base": {
        "name": "Kronos-base",
        "model_id": "NeoQuasar/Kronos-base",
        "tokenizer_id": "NeoQuasar/Kronos-Tokenizer-base",
        "context_length": 512,
        "params": "102.3M",
        "description": "High-precision 102.3M K-line Foundation Model (512 Context)"
    }
}

# Cache loaded predictors in memory
predictors_cache: Dict[str, Any] = {}
default_model_key = os.environ.get("KRONOS_DEFAULT_MODEL", "kronos-mini")


def get_or_load_predictor(model_key: str = "kronos-mini"):
    if not MODEL_AVAILABLE:
        raise HTTPException(status_code=503, detail="Kronos PyTorch dependencies not available")

    if model_key not in AVAILABLE_MODELS:
        model_key = "kronos-mini"

    if model_key in predictors_cache:
        return predictors_cache[model_key], AVAILABLE_MODELS[model_key]

    cfg = AVAILABLE_MODELS[model_key]
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    tokenizer = KronosTokenizer.from_pretrained(cfg["tokenizer_id"])
    model = Kronos.from_pretrained(cfg["model_id"])
    predictor = KronosPredictor(model, tokenizer, device=device, max_context=cfg["context_length"])
    predictors_cache[model_key] = predictor
    return predictor, cfg


class CandleInput(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = 0.0


class PredictRequest(BaseModel):
    symbol: str
    candles: List[CandleInput]
    pred_len: int = 24
    model_key: str = "kronos-small"
    temperature: float = 0.85
    top_p: float = 0.9
    sample_count: int = 10


class BatchItemInput(BaseModel):
    symbol: str
    candles: List[CandleInput]


class BatchPredictRequest(BaseModel):
    items: List[BatchItemInput]
    pred_len: int = 12
    model_key: str = "kronos-mini"
    temperature: float = 0.85
    top_p: float = 0.9
    sample_count: int = 3


@app.get("/")
@app.get("/api/kronos/status")
def status():
    device = "cuda:0" if (MODEL_AVAILABLE and torch.cuda.is_available()) else "cpu"
    return {
        "status": "online",
        "model_available": MODEL_AVAILABLE,
        "device": device,
        "loaded_models": list(predictors_cache.keys()),
        "available_models": AVAILABLE_MODELS
    }


@app.post("/api/kronos/predict")
def predict_kline(req: PredictRequest):
    if len(req.candles) < 20:
        raise HTTPException(status_code=400, detail="Need at least 20 historical candles for Kronos inference")

    start_time = time.time()
    predictor, cfg = get_or_load_predictor(req.model_key)

    lookback = min(len(req.candles), cfg["context_length"] - req.pred_len)
    sliced = req.candles[-lookback:]

    df = pd.DataFrame([
        {
            "open": c.open,
            "high": c.high,
            "low": c.low,
            "close": c.close,
            "volume": c.volume or 0.0,
            "timestamps": pd.to_datetime(c.time, unit="s")
        }
        for c in sliced
    ])

    last_ts = sliced[-1].time
    step_sec = sliced[-1].time - sliced[-2].time if len(sliced) > 1 else 3600
    if step_sec <= 0:
        step_sec = 3600

    future_unix = [last_ts + (i + 1) * step_sec for i in range(req.pred_len)]
    x_timestamp = pd.Series(pd.to_datetime([c.time for c in sliced], unit="s"), name="timestamps")
    y_timestamp = pd.Series(pd.to_datetime(future_unix, unit="s"), name="timestamps")

    pred_df, quantiles, bull_prob = predictor.predict_quantiles(
        df=df[["open", "high", "low", "close", "volume"]],
        x_timestamp=x_timestamp,
        y_timestamp=y_timestamp,
        pred_len=req.pred_len,
        T=req.temperature,
        top_p=req.top_p,
        sample_count=req.sample_count,
        verbose=False
    )

    predicted_candles = []
    for i, (_, row) in enumerate(pred_df.iterrows()):
        predicted_candles.append({
            "time": int(future_unix[i]),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(max(0.0, row["volume"]))
        })

    latency_ms = int((time.time() - start_time) * 1000)

    return {
        "success": True,
        "symbol": req.symbol,
        "model_used": cfg["name"],
        "params": cfg["params"],
        "context_length": cfg["context_length"],
        "latency_ms": latency_ms,
        "bull_probability": bull_prob,
        "predicted_candles": predicted_candles,
        "quantiles": {
            "times": future_unix,
            "p05": quantiles["p05"],
            "p15": quantiles["p15"],
            "p50": quantiles["p50"],
            "p85": quantiles["p85"],
            "p95": quantiles["p95"],
        }
    }


@app.post("/api/kronos/batch")
def predict_batch_klines(req: BatchPredictRequest):
    if not req.items:
        return {"success": True, "results": {}}

    predictor, cfg = get_or_load_predictor(req.model_key)
    min_len = min(len(item.candles) for item in req.items)
    lookback = min(min_len, 120)

    df_list = []
    x_ts_list = []
    y_ts_list = []
    future_times_map = {}

    for item in req.items:
        sliced = item.candles[-lookback:]
        df = pd.DataFrame([
            {
                "open": c.open,
                "high": c.high,
                "low": c.low,
                "close": c.close,
                "volume": c.volume or 0.0
            }
            for c in sliced
        ])
        last_ts = sliced[-1].time
        step_sec = sliced[-1].time - sliced[-2].time if len(sliced) > 1 else 3600
        future_unix = [last_ts + (i + 1) * step_sec for i in range(req.pred_len)]
        future_times_map[item.symbol] = future_unix

        df_list.append(df)
        x_ts_list.append(pd.Series(pd.to_datetime([c.time for c in sliced], unit="s")))
        y_ts_list.append(pd.Series(pd.to_datetime(future_unix, unit="s")))

    pred_dfs = predictor.predict_batch(
        df_list=df_list,
        x_timestamp_list=x_ts_list,
        y_timestamp_list=y_ts_list,
        pred_len=req.pred_len,
        T=req.temperature,
        top_p=req.top_p,
        sample_count=req.sample_count,
        verbose=False
    )

    results = {}
    for i, item in enumerate(req.items):
        p_df = pred_dfs[i]
        last_close = item.candles[-1].close
        pred_close = float(p_df["close"].iloc[-1])
        change_pct = ((pred_close - last_close) / last_close) * 100 if last_close > 0 else 0.0
        results[item.symbol] = {
            "target_price": round(pred_close, 4),
            "expected_change_pct": round(change_pct, 2),
            "high_max": round(float(p_df["high"].max()), 4),
            "low_min": round(float(p_df["low"].min()), 4)
        }

    return {
        "success": True,
        "model_used": cfg["name"],
        "results": results
    }


@app.post("/api/kronos/walk-forward")
def walk_forward_verify(req: PredictRequest):
    if len(req.candles) < 45:
        raise HTTPException(status_code=400, detail="Need at least 45 historical candles for walk-forward verification")

    holdout = min(24, max(12, min(req.pred_len, len(req.candles) // 4)))
    history = req.candles[:-holdout]
    actual = req.candles[-holdout:]

    predictor, cfg = get_or_load_predictor(req.model_key)
    lookback = min(len(history), cfg["context_length"] - holdout)
    sliced = history[-lookback:]

    df = pd.DataFrame([
        {
            "open": c.open,
            "high": c.high,
            "low": c.low,
            "close": c.close,
            "volume": c.volume or 0.0
        }
        for c in sliced
    ])

    x_timestamp = pd.Series(pd.to_datetime([c.time for c in sliced], unit="s"), name="timestamps")
    y_timestamp = pd.Series(pd.to_datetime([c.time for c in actual], unit="s"), name="timestamps")

    _, quantiles, _ = predictor.predict_quantiles(
        df=df,
        x_timestamp=x_timestamp,
        y_timestamp=y_timestamp,
        pred_len=holdout,
        T=req.temperature,
        top_p=req.top_p,
        sample_count=req.sample_count,
        verbose=False
    )

    p50 = np.array(quantiles["p50"], dtype=np.float64)
    y_true = np.array([c.close for c in actual], dtype=np.float64)
    anchor_close = float(sliced[-1].close)

    mape = float(np.mean(np.abs(p50 - y_true) / np.maximum(1e-8, y_true)) * 100.0)
    rmse = float(np.sqrt(np.mean((p50 - y_true) ** 2)))
    dir_hits = np.mean(((p50 - anchor_close) * (y_true - anchor_close)) >= 0) * 100.0

    backtest_path = [{"time": int(sliced[-1].time), "price": round(anchor_close, 4)}]
    for i, c in enumerate(actual):
        backtest_path.append({"time": int(c.time), "price": round(float(p50[i]), 4)})

    return {
        "success": True,
        "symbol": req.symbol,
        "holdout_bars": holdout,
        "directional_accuracy": round(float(dir_hits), 1),
        "mape_percent": round(mape, 2),
        "rmse": round(rmse, 4),
        "backtest_path": backtest_path
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
