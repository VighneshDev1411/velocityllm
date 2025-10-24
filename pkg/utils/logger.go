package utils

import (
	"log"
	"os"
)

// Logger levels
const (
	LogLevelDebug = "debug"
	LogLevelInfo  = "info"
	LogLevelWarn  = "warn"
	LogLevelError = "error"
)

// Logger is a simple structured logger
type Logger struct {
	level string
}

var defaultLogger *Logger

func init() {
	defaultLogger = NewLogger(LogLevelInfo)
}

// NewLogger creates a new logger instance
func NewLogger(level string) *Logger {
	return &Logger{
		level: level,
	}
}

// GetLogger returns the default logger instance
func GetLogger() *Logger {
	return defaultLogger
}

// Debug logs a debug message
func (l *Logger) Debug(format string, args ...interface{}) {
	if l.shouldLog(LogLevelDebug) {
		log.Printf("[DEBUG] "+format, args...)
	}
}

// Info logs an info message
func (l *Logger) Info(format string, args ...interface{}) {
	if l.shouldLog(LogLevelInfo) {
		log.Printf("[INFO] "+format, args...)
	}
}

// Warn logs a warning message
func (l *Logger) Warn(format string, args ...interface{}) {
	if l.shouldLog(LogLevelWarn) {
		log.Printf("[WARN] "+format, args...)
	}
}

// Error logs an error message
func (l *Logger) Error(format string, args ...interface{}) {
	if l.shouldLog(LogLevelError) {
		log.Printf("[ERROR] "+format, args...)
	}
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(format string, args ...interface{}) {
	log.Printf("[FATAL] "+format, args...)
	os.Exit(1)
}

// shouldLog determines if a message should be logged based on level
func (l *Logger) shouldLog(messageLevel string) bool {
	levels := map[string]int{
		LogLevelDebug: 0,
		LogLevelInfo:  1,
		LogLevelWarn:  2,
		LogLevelError: 3,
	}

	configLevel, ok := levels[l.level]
	if !ok {
		configLevel = levels[LogLevelInfo]
	}

	msgLevel, ok := levels[messageLevel]
	if !ok {
		return true
	}

	return msgLevel >= configLevel
}

// Convenience functions using default logger

// Debug logs a debug message using the default logger
func Debug(format string, args ...interface{}) {
	defaultLogger.Debug(format, args...)
}

// Info logs an info message using the default logger
func Info(format string, args ...interface{}) {
	defaultLogger.Info(format, args...)
}

// Warn logs a warning message using the default logger
func Warn(format string, args ...interface{}) {
	defaultLogger.Warn(format, args...)
}

// Error logs an error message using the default logger
func Error(format string, args ...interface{}) {
	defaultLogger.Error(format, args...)
}

// Fatal logs a fatal message using the default logger and exits
func Fatal(format string, args ...interface{}) {
	defaultLogger.Fatal(format, args...)
}
