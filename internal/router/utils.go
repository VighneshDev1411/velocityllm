package router

// contains checks if a string contains a substring (case-insensitive)
func contains(str, substr string) bool {
	str = toLower(str)
	substr = toLower(substr)
	return len(str) >= len(substr) && indexOf(str, substr) >= 0
}

// toLower converts string to lowercase
func toLower(s string) string {
	result := make([]rune, 0, len(s))
	for _, r := range s {
		if r >= 'A' && r <= 'Z' {
			result = append(result, r+32)
		} else {
			result = append(result, r)
		}
	}
	return string(result)
}

// indexOf finds the index of substring in string
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			if s[i+j] != substr[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}
