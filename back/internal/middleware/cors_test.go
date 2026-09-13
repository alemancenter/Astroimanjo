package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestCORS(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	app := fiber.New()
	app.Use(CORS())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	t.Run("CORS headers are set", func(t *testing.T) {
		req := httptest.NewRequest("OPTIONS", "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Access-Control-Request-Method", "GET")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("Failed to execute request: %v", err)
		}

		// Since AllowOrigins is "*", Allow-Origin header will be set appropriately
		origin := resp.Header.Get("Access-Control-Allow-Origin")
		if origin == "" {
			t.Errorf("Expected CORS headers to be set")
		}
	})
}

func TestCORSDoesNotAllowFrontendSecretHeader(t *testing.T) {
t.Setenv("APP_ENV", "production")
t.Setenv("CORS_ALLOWED_ORIGINS", "https://imanjo.com")

app := fiber.New()
app.Use(CORS())
app.Post("/test", func(c *fiber.Ctx) error {
return c.SendStatus(fiber.StatusNoContent)
})

req := httptest.NewRequest(http.MethodOptions, "/test", nil)
req.Header.Set("Origin", "https://imanjo.com")
req.Header.Set("Access-Control-Request-Method", http.MethodPost)
req.Header.Set("Access-Control-Request-Headers", "X-Frontend-Key,Content-Type")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("Failed to execute request: %v", err)
}
allowedHeaders := resp.Header.Get("Access-Control-Allow-Headers")
if strings.Contains(strings.ToLower(allowedHeaders), "x-frontend-key") {
t.Fatalf("expected X-Frontend-Key to be absent from CORS policy, got %q", allowedHeaders)
}
if strings.Contains(strings.ToLower(allowedHeaders), "x-csrf-token") {
t.Fatalf("expected unused X-CSRF-Token to be absent from CORS policy, got %q", allowedHeaders)
}
}
