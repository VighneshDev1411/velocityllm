package utils

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"
)

// LogLevel represents the severity of a log message
type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
	FATAL
)

// String returns the string representation of LogLevel
func (l LogLevel) String() string {
	switch l {
	case DEBUG:
		return "DEBUG"
	case INFO:
		return "INFO"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	case FATAL:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// Color codes for terminal output
const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorPurple = "\033[35m"
	colorCyan   = "\033[36m"
	colorWhite  = "\033[37m"
	colorGray   = "\033[90m"
)

// Logger provides structured logging functionality
type Logger struct {
	level      LogLevel
	mu         sync.Mutex
	useColor   bool
	timestamps bool
	caller     bool
	output     *log.Logger
}

// LoggerConfig holds logger configuration
type LoggerConfig struct {
	Level      LogLevel
	UseColor   bool
	Timestamps bool
	Caller     bool
}

// DefaultLoggerConfig returns default logger configuration
func DefaultLoggerConfig() *LoggerConfig {
	return &LoggerConfig{
		Level:      INFO,
		UseColor:   true,
		Timestamps: true,
		Caller:     false,
	}
}

// NewLogger creates a new logger with default configuration
func NewLogger() *Logger {
	config := DefaultLoggerConfig()
	return NewLoggerWithConfig(config)
}

// NewLoggerWithConfig creates a new logger with custom configuration
func NewLoggerWithConfig(config *LoggerConfig) *Logger {
	return &Logger{
		level:      config.Level,
		useColor:   config.UseColor,
		timestamps: config.Timestamps,
		caller:     config.Caller,
		output:     log.New(os.Stdout, "", 0),
	}
}

// SetLevel sets the minimum log level
func (l *Logger) SetLevel(level LogLevel) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// GetLevel returns the current log level
func (l *Logger) GetLevel() LogLevel {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.level
}

// log is the internal logging function
func (l *Logger) log(level LogLevel, msg string, fields ...interface{}) {
	if level < l.level {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	// Build log message
	var sb strings.Builder

	// Add timestamp
	if l.timestamps {
		timestamp := time.Now().Format("2006-01-02 15:04:05.000")
		if l.useColor {
			sb.WriteString(colorGray)
		}
		sb.WriteString("[")
		sb.WriteString(timestamp)
		sb.WriteString("] ")
		if l.useColor {
			sb.WriteString(colorReset)
		}
	}

	// Add level with color
	levelColor := l.getLevelColor(level)
	if l.useColor {
		sb.WriteString(levelColor)
	}
	sb.WriteString("[")
	sb.WriteString(level.String())
	sb.WriteString("] ")
	if l.useColor {
		sb.WriteString(colorReset)
	}

	// Add caller information if enabled
	if l.caller {
		_, file, line, ok := runtime.Caller(2)
		if ok {
			// Get just the filename, not full path
			parts := strings.Split(file, "/")
			file = parts[len(parts)-1]

			if l.useColor {
				sb.WriteString(colorCyan)
			}
			sb.WriteString(fmt.Sprintf("[%s:%d] ", file, line))
			if l.useColor {
				sb.WriteString(colorReset)
			}
		}
	}

	// Add message
	sb.WriteString(msg)

	// Add fields if present
	if len(fields) > 0 {
		sb.WriteString(" ")
		l.formatFields(&sb, fields...)
	}

	// Write log
	l.output.Println(sb.String())

	// Exit on fatal
	if level == FATAL {
		os.Exit(1)
	}
}

// formatFields formats key-value pairs for logging
func (l *Logger) formatFields(sb *strings.Builder, fields ...interface{}) {
	if len(fields)%2 != 0 {
		sb.WriteString("INVALID_FIELDS")
		return
	}

	for i := 0; i < len(fields); i += 2 {
		if i > 0 {
			sb.WriteString(" ")
		}

		key := fmt.Sprintf("%v", fields[i])
		value := fields[i+1]

		if l.useColor {
			sb.WriteString(colorCyan)
		}
		sb.WriteString(key)
		if l.useColor {
			sb.WriteString(colorReset)
		}
		sb.WriteString("=")

		// Format value
		switch v := value.(type) {
		case string:
			sb.WriteString(fmt.Sprintf("%q", v))
		case error:
			if l.useColor {
				sb.WriteString(colorRed)
			}
			sb.WriteString(fmt.Sprintf("%q", v.Error()))
			if l.useColor {
				sb.WriteString(colorReset)
			}
		default:
			sb.WriteString(fmt.Sprintf("%v", v))
		}
	}
}

// getLevelColor returns the color for a log level
func (l *Logger) getLevelColor(level LogLevel) string {
	switch level {
	case DEBUG:
		return colorGray
	case INFO:
		return colorGreen
	case WARN:
		return colorYellow
	case ERROR:
		return colorRed
	case FATAL:
		return colorPurple
	default:
		return colorWhite
	}
}

// Debug logs a debug message
func (l *Logger) Debug(msg string, fields ...interface{}) {
	l.log(DEBUG, msg, fields...)
}

// Info logs an info message
func (l *Logger) Info(msg string, fields ...interface{}) {
	l.log(INFO, msg, fields...)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string, fields ...interface{}) {
	l.log(WARN, msg, fields...)
}

// Error logs an error message
func (l *Logger) Error(msg string, fields ...interface{}) {
	l.log(ERROR, msg, fields...)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(msg string, fields ...interface{}) {
	l.log(FATAL, msg, fields...)
}

// WithFields creates a new logger with preset fields
type LoggerWithFields struct {
	logger *Logger
	fields []interface{}
}

// WithFields returns a logger with preset fields
func (l *Logger) WithFields(fields ...interface{}) *LoggerWithFields {
	return &LoggerWithFields{
		logger: l,
		fields: fields,
	}
}

// Debug logs a debug message with preset fields
func (lf *LoggerWithFields) Debug(msg string, fields ...interface{}) {
	allFields := append(lf.fields, fields...)
	lf.logger.Debug(msg, allFields...)
}

// Info logs an info message with preset fields
func (lf *LoggerWithFields) Info(msg string, fields ...interface{}) {
	allFields := append(lf.fields, fields...)
	lf.logger.Info(msg, allFields...)
}

// Warn logs a warning message with preset fields
func (lf *LoggerWithFields) Warn(msg string, fields ...interface{}) {
	allFields := append(lf.fields, fields...)
	lf.logger.Warn(msg, allFields...)
}

// Error logs an error message with preset fields
func (lf *LoggerWithFields) Error(msg string, fields ...interface{}) {
	allFields := append(lf.fields, fields...)
	lf.logger.Error(msg, allFields...)
}

// Fatal logs a fatal message with preset fields and exits
func (lf *LoggerWithFields) Fatal(msg string, fields ...interface{}) {
	allFields := append(lf.fields, fields...)
	lf.logger.Fatal(msg, allFields...)
}

// LogRequest logs an HTTP request
func (l *Logger) LogRequest(method, path string, statusCode int, duration time.Duration, fields ...interface{}) {
	allFields := append([]interface{}{
		"method", method,
		"path", path,
		"status", statusCode,
		"duration_ms", duration.Milliseconds(),
	}, fields...)

	level := INFO
	if statusCode >= 500 {
		level = ERROR
	} else if statusCode >= 400 {
		level = WARN
	}

	l.log(level, "HTTP Request", allFields...)
}

// LogStream logs streaming events
func (l *Logger) LogStream(event string, streamID string, fields ...interface{}) {
	allFields := append([]interface{}{
		"event", event,
		"stream_id", streamID,
	}, fields...)

	l.Info("Stream Event", allFields...)
}

// Performance logging helpers

// Timer helps measure execution time
type Timer struct {
	start  time.Time
	logger *Logger
	name   string
	fields []interface{}
}

// StartTimer starts a new timer
func (l *Logger) StartTimer(name string, fields ...interface{}) *Timer {
	return &Timer{
		start:  time.Now(),
		logger: l,
		name:   name,
		fields: fields,
	}
}

// Stop stops the timer and logs the duration
func (t *Timer) Stop() {
	duration := time.Since(t.start)
	allFields := append(t.fields, "duration_ms", duration.Milliseconds())
	t.logger.Info(fmt.Sprintf("Timer: %s", t.name), allFields...)
}

// StopWithMessage stops the timer with a custom message
func (t *Timer) StopWithMessage(msg string) {
	duration := time.Since(t.start)
	allFields := append(t.fields, "duration_ms", duration.Milliseconds())
	t.logger.Info(msg, allFields...)
}
