import pandas as pd
import numpy as np
import json
import os
from typing import Dict, Any, List

# --- HELPER FUNCTIONS ---

def seconds_to_dhms(seconds: float) -> str:
    """Converts total seconds to a human-friendly time like "1 day 2 hours 5 minutes".

    Hours and minutes are shown without leading zeros (e.g., "2 hours", not "02 hours").
    """
    seconds = int(seconds)
    days = seconds // (24 * 3600)
    seconds %= (24 * 3600)
    hours = seconds // 3600
    seconds %= 3600
    minutes = seconds // 60
    seconds %= 60

    def plural(n: int, singular: str, plural_s: str) -> str:
        return f"{n} {singular if n == 1 else plural_s}"

    parts = []
    if days > 0:
        parts.append(plural(days, "day", "days"))
    if hours > 0:
        parts.append(plural(hours, "hour", "hours"))
    # Always include minutes (no leading zeros)
    parts.append(plural(minutes, "minute", "minutes"))

    return " ".join(parts)

def format_time(minutes: float) -> str:
    """Converts minutes (float) to Mm Ss format."""
    total_seconds = int(minutes * 60)
    m = total_seconds // 60
    s = total_seconds % 60
    return f"{m}m {s:02d}s"

def format_deviation_time(deviation_min: float) -> str:
    """Formats deviation time with a required +/- sign."""
    sign = "+" if deviation_min >= 0 else "-"
    minutes_abs = abs(deviation_min)
    total_seconds = int(minutes_abs * 60)
    m = total_seconds // 60
    s = total_seconds % 60
    return f"{m}m {s:02d}s"
    #return f"{sign}{m}m {s:02d}s"

# --- CORE DATA PREPARATION ---

def clean_and_preprocess(file_path: str) -> pd.DataFrame:
    """Loads, cleans, and prepares the crossword data for analysis."""
    df = pd.read_csv(file_path)

    # 1. Standard Cleaning and Filtering
    df['print_date'] = pd.to_datetime(df['print_date'])
    df_solved = df[
        (df['solved'] == True) &
        (df['percent_filled'] == 100)
    ].copy()

    # 2. Add Time and Day columns
    day_order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    df_solved['Day_of_Week'] = df_solved['print_date'].dt.strftime('%a')
    df_solved['Day_of_Week'] = pd.Categorical(df_solved['Day_of_Week'], categories=day_order, ordered=True)
    df_solved['minutesSpentSolving'] = df_solved['secondsSpentSolving'] / 60
    
    # 3. Add Daily Statistics for Outlier Calculation (Cards 5 & 6)
    daily_stats = df_solved.groupby('Day_of_Week')['minutesSpentSolving'].agg(
        daily_mean='mean', daily_std='std'
    ).reset_index()
    
    df_solved = df_solved.merge(daily_stats, on='Day_of_Week', how='left')
    
    # 4. Calculate Z-Score for Outliers (Deviation Score)
    # Positive Z-score = slower than average; Negative Z-score = faster than average
    df_solved['z_score'] = (df_solved['minutesSpentSolving'] - df_solved['daily_mean']) / df_solved['daily_std']

    return df_solved.sort_values(by='print_date').reset_index(drop=True)

# --- CARD-SPECIFIC DATA GENERATION FUNCTIONS ---

def prepare_card_1_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """Generates the high-level summary statistics."""
    min_date = df['print_date'].min()
    max_date = df['print_date'].max()
    
    total_completed = len(df)
    total_days_in_range = (max_date - min_date).days + 1
    
    total_seconds = df['secondsSpentSolving'].sum()
    
    # Use the 'star' field as confirmed: 'Gold' means no hints used
    gold_star_completed = len(df[df['star'] == 'Gold'])
    
    return {
        'total_completed': total_completed,
        'gold_star_completed': gold_star_completed,
        'total_available': total_days_in_range,
        'completion_rate_pct': round((total_completed / total_days_in_range) * 100, 1),
        'total_time_dhms': seconds_to_dhms(total_seconds),
        'date_range': f"{min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}"
    }

def prepare_card_2_weekly_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Generates the fastest, average, and slowest times per day of the week."""
    # Use observed=True to handle the Categorical Day_of_Week, silencing the FutureWarning
    weekly_stats = df.groupby('Day_of_Week', observed=True)['minutesSpentSolving'].agg(
        fastest_in_minutes='min',
        average_in_minutes='mean',
        slowest_in_minutes='max'
    ).reset_index()

    # Add a formatted time column for the front-end display
    for col in ['fastest_in_minutes', 'average_in_minutes', 'slowest_in_minutes']:
        weekly_stats[f'{col}_Time'] = weekly_stats[col].apply(format_time)
        
    return weekly_stats

def prepare_card_3_histograms(df: pd.DataFrame, num_bins: int = 8) -> pd.DataFrame:
    """Generates frequency histogram data (8 buckets) for each day."""
    histogram_data: List[Dict[str, Any]] = []
    
    for day in df['Day_of_Week'].cat.categories:
        day_df = df[df['Day_of_Week'] == day]
        if day_df.empty:
            continue
            
        # Determine bins based on min and max for that specific day
        min_time = day_df['minutesSpentSolving'].min()
        max_time = day_df['minutesSpentSolving'].max()
        
        # Create bins and calculate frequency
        bins = np.linspace(min_time, max_time, num_bins + 1)
        hist, bin_edges = np.histogram(day_df['minutesSpentSolving'], bins=bins)
        
        for i in range(num_bins):
            # Calculate the midpoint for the bar's placement
            midpoint = (bin_edges[i] + bin_edges[i+1]) / 2
            
            histogram_data.append({
                'Day_of_Week': day,
                'bin_index': i,
                'frequency': int(hist[i]), # Ensure int for JSON
                'time_start_min': bin_edges[i],
                'time_end_min': bin_edges[i+1],
                'time_range_label': f"{format_time(bin_edges[i])} - {format_time(bin_edges[i+1])}",
                'midpoint_min': midpoint
            })

    return pd.DataFrame(histogram_data)

def prepare_card_4_evolution(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generates the Running Average Time evolution over the year.
    For each puzzle on a given day (e.g., the 5th Monday), calculates
    the average time of all puzzles on that day *so far* this year.
    """
    
    # 1. Sort chronologically by date
    df_sorted = df.sort_values('print_date').reset_index(drop=True)
    
    # 2. Add 'day_of_year'
    df_sorted['day_of_year'] = df_sorted['print_date'].dt.dayofyear
    
    # 3. Calculate Cumulative Sum of Time (in seconds)
    df_sorted['cumulative_seconds'] = df_sorted.groupby('Day_of_Week', observed=True)['secondsSpentSolving'].cumsum()
    
    # 4. Calculate Cumulative Count of Puzzles
    # cumcount() starts at 0, so we add 1 to get the total number of puzzles so far.
    df_sorted['cumulative_count'] = df_sorted.groupby('Day_of_Week', observed=True).cumcount() + 1
    
    # 5. Calculate the Running Average (in minutes)
    df_sorted['average_time_min'] = (
        df_sorted['cumulative_seconds'] / df_sorted['cumulative_count']
    ) / 60
    
    # 6. Prepare final columns for JSON output
    weekly_evolution = df_sorted[[
        'print_date',
        'Day_of_Week',
        'day_of_year', # Used for continuous X-axis plotting
        'cumulative_count', # How many of this day have been solved so far
        'average_time_min'
    ]].copy()
    
    # Add formatted time for display
    weekly_evolution['average_time_formatted'] = weekly_evolution['average_time_min'].apply(format_time)
    
    # The output should contain every puzzle for a granular chart.
    return weekly_evolution.rename(columns={'cumulative_count': 'puzzle_index'})

def prepare_cards_5_6_outliers(df: pd.DataFrame, top_n: int = 10) -> Dict[str, pd.DataFrame]:
    """Finds the top N fastest and slowest puzzles based on Z-score, including time deviation."""
    
    # Filter out days where STD is 0 (all times are the same) to avoid division by zero errors
    df_clean = df[df['daily_std'].notna() & (df['daily_std'] > 0)].copy()

    # Slower days (largest positive Z-score)
    slowest_outliers = df_clean.nlargest(top_n, 'z_score')
    
    # Faster days (largest negative Z-score)
    fastest_outliers = df_clean.nsmallest(top_n, 'z_score')
    
    def prepare_outlier_df(outlier_df, sort_desc: bool = True):
        """Prepare and format an outlier dataframe.

        sort_desc: if True, sorts by `Deviation_Percent` descending (highest percent first).
                   if False, sorts by `Deviation_Percent` ascending (most negative percent first).
        """
        out = outlier_df.copy()

        # Compute percent and absolute deviations first
        out['Deviation_Percent'] = (
            (out['minutesSpentSolving'] - out['daily_mean']) / out['daily_mean']
        ) * 100
        out['Time_Deviation_min'] = out['minutesSpentSolving'] - out['daily_mean']

        # Rename and select columns for final output (include puzzle_id)
        final_df = out[[
            'print_date', 'puzzle_id', 'Day_of_Week', 'minutesSpentSolving', 'author', 'Deviation_Percent', 'Time_Deviation_min'
        ]].rename(columns={'minutesSpentSolving': 'Time_min', 'author': 'Author'})

        final_df['Date'] = final_df['print_date'].dt.strftime('%b %d, %Y')
        final_df['Time_formatted'] = final_df['Time_min'].apply(format_time)

        # Add formatted deviation labels
        final_df['Deviation_Percent_Label'] = final_df['Deviation_Percent'].apply(lambda x: f"{x:+.1f}%")
        final_df['Deviation_Time_Label'] = final_df['Time_Deviation_min'].apply(format_deviation_time)

        # Sort by Deviation_Percent according to requested direction
        final_df = final_df.sort_values(by='Deviation_Percent', ascending=not sort_desc)

        # Final column order (include puzzle_id)
        return final_df[['Date', 'puzzle_id', 'Day_of_Week', 'Time_formatted', 'Deviation_Percent_Label', 'Deviation_Time_Label', 'Author']]

    return {
        'struggles': prepare_outlier_df(slowest_outliers, sort_desc=True),
        'fast_days': prepare_outlier_df(fastest_outliers, sort_desc=False)
    }


# --- MASTER FUNCTION & EXECUTION ---

def generate_all_data(file_path: str, output_prefix: str, output_dir: str = 'data_output/card_data') -> None:
    """Runs the full data pipeline and saves all results to JSON files."""
    
    # 1. Setup Output Directory
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    print(f"--- Running Crossword Data Pipeline ---")
    
    # 2. Clean and Preprocess
    try:
        df_solved = clean_and_preprocess(file_path)
    except FileNotFoundError:
        print(f"ERROR: File not found at {file_path}. Please check the path.")
        return
    
    # 3. Generate Data for Each Card
    
    # Card 1: Summary Stats
    summary_data = prepare_card_1_summary(df_solved)
    with open(os.path.join(output_dir, f'{output_prefix}_card1_summary.json'), 'w') as f:
        json.dump(summary_data, f, indent=4)
    print(f"Generated Card 1 Summary (Completed: {summary_data['total_completed']})")

    # Card 2: Weekly Summary Table
    df_card2 = prepare_card_2_weekly_summary(df_solved)
    df_card2.to_json(os.path.join(output_dir, f'{output_prefix}_card2_weekly_summary.json'), orient='records', indent=4)
    print("Generated Card 2 Weekly Summary")

    # Card 3: Histograms
    df_card3 = prepare_card_3_histograms(df_solved, num_bins=8)
    df_card3.to_json(os.path.join(output_dir, f'{output_prefix}_card3_histograms.json'), orient='records', indent=4)
    print("Generated Card 3 Histograms (8 Bins/Day)")

    # Card 4: Time Evolution
    df_card4 = prepare_card_4_evolution(df_solved)
    df_card4.to_json(os.path.join(output_dir, f'{output_prefix}_card4_evolution.json'), orient='records', indent=4)
    print("Generated Card 4 Time Evolution (Weekly Running Average)")

    # Cards 5 & 6: Outliers
    outlier_data = prepare_cards_5_6_outliers(df_solved, top_n=10)
    
    outlier_data['struggles'].to_json(os.path.join(output_dir, f'{output_prefix}_card5_struggles.json'), orient='records', indent=4)
    outlier_data['fast_days'].to_json(os.path.join(output_dir, f'{output_prefix}_card6_fast_days.json'), orient='records', indent=4)
    print("Generated Cards 5 & 6 Outlier Puzzles (Top 10 Fastest/Slowest)")

    print(f"\n--- Pipeline Complete! All 6 JSON files saved to the '{output_dir}' folder. ---")


if __name__ == '__main__':
    INPUT_FILE = 'data_output/puzzle_data.csv'
    OUTPUT_PREFIX = ''
    
    generate_all_data(INPUT_FILE, OUTPUT_PREFIX)