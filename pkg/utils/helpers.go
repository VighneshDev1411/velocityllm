package utils

import "fmt"

// ToString converts any value to string
func ToString(v interface{}) string {
	return fmt.Sprintf("%v", v)
}
