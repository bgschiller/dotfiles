#!/bin/bash

# Weather monitoring script for launchd
# Checks temperature and notifies when it crosses 70°F for the first time today

# Configuration
LATITUDE="45.4707567329151"      # Change this to your latitude
LONGITUDE="-122.63387085446011"  # Change this to your longitude
TIMEZONE="America%2FLos_Angeles" # Change this to your timezone (URL encoded)
TEMP_THRESHOLD=70
LOG_FILE="$HOME/.weather_monitor.log"
STATE_FILE="$HOME/.weather_monitor_state"

# Function to log messages
log_message() {
  echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" >>"$LOG_FILE"
}

# Function to send notification
send_notification() {
  local message="$1"
  # Use macOS notification system
  osascript -e "display notification \"$message\" with title \"Weather Alert\" sound name \"Frog\""
  log_message "NOTIFICATION: $message"
}

# Function to get current temperature
get_temperature() {
  local url="https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m&timezone=${TIMEZONE}&forecast_days=1&temperature_unit=fahrenheit"
  local temp=$(curl -s "$url" | jq -r '.current.temperature_2m // "ERROR"' | awk '{print int($1+0.5)}')
  echo "$temp"
}

# Check if we're in the active season (May through September)
current_month=$(date '+%m')
if [ "$current_month" -lt 5 ] || [ "$current_month" -gt 9 ]; then
  log_message "Outside active season (May-September), exiting"
  exit 0
fi

# Check if we need to reset the daily state (new day)
current_date=$(date '+%Y-%m-%d')
if [ -f "$STATE_FILE" ]; then
  last_date=$(head -n 1 "$STATE_FILE" 2>/dev/null || echo "")
  if [ "$last_date" != "$current_date" ]; then
    # New day, reset state
    echo "$current_date" >"$STATE_FILE"
    echo "false" >>"$STATE_FILE" # notification_sent flag
    log_message "New day detected, resetting state"
  fi
else
  # First run, create state file
  echo "$current_date" >"$STATE_FILE"
  echo "false" >>"$STATE_FILE"
  log_message "Initial state file created"
fi

# Read current state
notification_sent=$(sed -n '2p' "$STATE_FILE" 2>/dev/null || echo "false")

# If notification already sent today, exit early without API call
if [ "$notification_sent" = "true" ]; then
  log_message "Notification already sent today, skipping API call"
  exit 0
fi

# Get current temperature
current_temp=$(get_temperature)

if [ "$current_temp" = "ERROR" ]; then
  log_message "ERROR: Failed to get temperature data"
  exit 1
fi

log_message "Current temperature: ${current_temp}°F"

# Check if we should send notification
if [ "$current_temp" -ge "$TEMP_THRESHOLD" ]; then
  send_notification "Time to close the windows! Temperature: ${current_temp}°F"

  # Update state to mark notification as sent
  echo "$current_date" >"$STATE_FILE"
  echo "true" >>"$STATE_FILE"
else
  log_message "Temperature below threshold (${current_temp}°F < ${TEMP_THRESHOLD}°F)"
fi
