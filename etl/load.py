"""Database loading module with chunked insertions."""

import pandas as pd
from sqlalchemy.engine import Engine


def load_dataframe_to_sql(
    df: pd.DataFrame,
    table_name: str,
    engine: Engine,
    if_exists: str = "append",
    chunksize: int = 5000,
) -> int:
    """Insert DataFrame in batches into target MySQL database table."""
    df.to_sql(
        name=table_name,
        con=engine,
        if_exists=if_exists,
        index=False,
        chunksize=chunksize,
        method="multi",
    )
    return len(df)
