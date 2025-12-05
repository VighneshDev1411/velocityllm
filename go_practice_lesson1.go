package main

import "fmt"

// ============================================
// GO FUNDAMENTALS - LESSON 1 PRACTICE TASKS
// ============================================
// Complete all three tasks below
// Run with: go run go_practice_lesson1.go
// ============================================

func main() {
	fmt.Println("=== GO PRACTICE - LESSON 1 ===")

	// Uncomment the task you're working on:
	// task1_CalculateLLMCost()
	// task2_RequestStatistics()
	// task3_ModelRouter()
}

// ============================================
// TASK 1.1: Calculate LLM Cost
// ============================================
// Instructions:
// 1. Create a map with model names and their costs per 1K tokens:
//    - gpt-4: $0.03
//    - gpt-3.5-turbo: $0.002
//    - claude-3-opus: $0.015
//    - claude-3-sonnet: $0.003
//    - llama-3-8b: $0.0
// 2. Take a model name and token count
// 3. Calculate the total cost
// 4. Handle unknown models (print error message)
//
// Expected Output Example:
// Model: gpt-4
// Tokens: 1500
// Cost: $0.045
// ============================================

func task1_CalculateLLMCost() {
	fmt.Println("--- Task 1: Calculate LLM Cost ---")

	// TODO: Create a map of model costs
	// modelCosts := map[string]float64{
	//     ...
	// }

	// TODO: Define model name and token count
	// modelName := "gpt-4"
	// tokenCount := 1500

	// TODO: Check if model exists in the map
	// TODO: Calculate cost (tokens / 1000 * cost_per_1k)
	// TODO: Print the result

	fmt.Println() // Empty line for separation
}

// ============================================
// TASK 1.2: Request Statistics
// ============================================
// Instructions:
// 1. Use this slice of latencies: []int{120, 150, 200, 180, 160, 220, 190}
// 2. Calculate and print:
//    - Total number of requests
//    - Average latency
//    - Minimum latency
//    - Maximum latency
//    - Count of requests under 200ms
//
// Expected Output Example:
// Total Requests: 7
// Average Latency: 174ms
// Min Latency: 120ms
// Max Latency: 220ms
// Requests under 200ms: 5
// ============================================

func task2_RequestStatistics() {
	fmt.Println("--- Task 2: Request Statistics ---")

	// Given data
	latencies := []int{120, 150, 200, 180, 160, 220, 190}
	_ = latencies // keep file compiling while tasks are left for practice

	// TODO: Calculate total requests (hint: use len())

	// TODO: Calculate average latency
	// - Sum all latencies
	// - Divide by count

	// TODO: Find minimum latency
	// - Loop through slice
	// - Track the smallest value

	// TODO: Find maximum latency
	// - Loop through slice
	// - Track the largest value

	// TODO: Count requests under 200ms
	// - Loop through slice
	// - Count values < 200

	// TODO: Print all statistics

	fmt.Println() // Empty line for separation
}

// ============================================
// TASK 1.3: Model Router
// ============================================
// Instructions:
// 1. Take a prompt complexity score (0-100)
// 2. Route to appropriate model based on complexity:
//    - Score 0-30:   Use gpt-3.5-turbo (reason: "Simple prompt, fast model")
//    - Score 31-70:  Use claude-3-sonnet (reason: "Medium complexity")
//    - Score 71-100: Use gpt-4 (reason: "Complex prompt, powerful model")
// 3. Print the selected model and reason
//
// Expected Output Example:
// Complexity Score: 85
// Selected Model: gpt-4
// Reason: Complex prompt, powerful model
//
// BONUS: Test with multiple complexity scores!
// ============================================

func task3_ModelRouter() {
	fmt.Println("--- Task 3: Model Router ---")

	// TODO: Define a complexity score (try different values: 25, 50, 85)
	// complexityScore := 85

	// TODO: Use if/else or switch to select model based on score
	// TODO: Print: Complexity Score, Selected Model, Reason

	// BONUS: Test with multiple scores
	// testScores := []int{15, 45, 85, 100, 0}
	// for _, score := range testScores {
	//     // Route each score and print result
	// }

	fmt.Println() // Empty line for separation
}

// ============================================
// HELPER NOTES:
// ============================================
//
// Common Go patterns you'll use:
//
// 1. Check if key exists in map:
//    value, exists := myMap[key]
//    if exists {
//        // use value
//    }
//
// 2. Loop through slice:
//    for index, value := range mySlice {
//        // use index and value
//    }
//
// 3. Loop with just index:
//    for i := 0; i < len(mySlice); i++ {
//        // use mySlice[i]
//    }
//
// 4. Ignore index in range:
//    for _, value := range mySlice {
//        // use value
//    }
//
// 5. Format floats in print:
//    fmt.Printf("Cost: $%.3f\n", cost)  // 3 decimal places
//
// 6. Calculate average:
//    sum := 0
//    for _, val := range numbers {
//        sum += val
//    }
//    average := float64(sum) / float64(len(numbers))
//
// ============================================
