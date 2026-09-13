package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/imanjo/fiber-api/internal/config"
	"github.com/gofiber/fiber/v2"
)

func testFrontendGuardConfig() *config.Config {
	return &config.Config{
		App: config.AppConfig{
			Env: "production",
			URL: "https://api.imanjo.com",
		},
		Frontend: config.FrontendConfig{
			APIKey:          "frontend-secret",
			CORSOrigins:     []string{"https://imanjo.com", "https://www.imanjo.com"},
			RateLimit:       false,
			SSRTrustedIPs:   []string{"127.0.0.1"},
			SSRRateLimitMax: 2000,
		},
	}
}

func newFrontendGuardTestApp() *fiber.App {
	app := fiber.New(fiber.Config{ProxyHeader: "X-Test-IP"})
	app.Get("/api/articles", frontendGuard(testFrontendGuardConfig()), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})
app.Post("/api/account/profile", frontendGuard(testFrontendGuardConfig()), func(c *fiber.Ctx) error {
return c.SendStatus(fiber.StatusNoContent)
})
app.Post("/api/auth/refresh", frontendGuard(testFrontendGuardConfig()), func(c *fiber.Ctx) error {
return c.SendStatus(fiber.StatusNoContent)
})
	app.Get("/api/auth/google/redirect", frontendGuard(testFrontendGuardConfig()), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})
	return app
}

func TestFrontendGuardBlocksDirectPublicAPIHostEvenWithAllowedOrigin(t *testing.T) {
	app := newFrontendGuardTestApp()

	req := httptest.NewRequest(http.MethodGet, "/api/articles", nil)
	req.Host = "api.imanjo.com"
	req.Header.Set("Origin", "https://imanjo.com")
	req.Header.Set("X-Forwarded-For", "198.51.100.10")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected direct API host status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
	}
}

func TestFrontendGuardBlocksDirectPublicAPIHostEvenWithBearerHeader(t *testing.T) {
	app := newFrontendGuardTestApp()

	req := httptest.NewRequest(http.MethodGet, "/api/articles", nil)
	req.Host = "api.imanjo.com"
	req.Header.Set("Authorization", "Bearer not-a-validated-token")
	req.Header.Set("X-Forwarded-For", "198.51.100.10")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected direct API host status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
	}
}

func TestFrontendGuardBlocksCookieMutationOnDirectPublicAPIHost(t *testing.T) {
app := newFrontendGuardTestApp()

req := httptest.NewRequest(http.MethodPost, "/api/account/profile", nil)
req.Host = "api.imanjo.com"
req.Header.Set("Origin", "https://imanjo.com")
req.Header.Set("Cookie", "token=session-token")
req.Header.Set("X-Forwarded-For", "198.51.100.10")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("app.Test failed: %v", err)
}
if resp.StatusCode != fiber.StatusNotFound {
t.Fatalf("expected direct API host cookie mutation status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
}
}

func TestFrontendGuardAllowsFrontendProxyKey(t *testing.T) {
	app := newFrontendGuardTestApp()

	req := httptest.NewRequest(http.MethodGet, "/api/articles", nil)
	req.Host = "api.imanjo.com"
	req.Header.Set("X-Frontend-Key", "frontend-secret")
	req.Header.Set("X-Forwarded-For", "198.51.100.10")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected frontend proxy status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}

func TestFrontendGuardKeepsOAuthRedirectPublic(t *testing.T) {
	app := newFrontendGuardTestApp()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/redirect", nil)
	req.Host = "api.imanjo.com"
	req.Header.Set("X-Forwarded-For", "198.51.100.10")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected OAuth redirect status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}

func TestFrontendGuardAllowsDirectLocalRequest(t *testing.T) {
	app := newFrontendGuardTestApp()

	req := httptest.NewRequest(http.MethodGet, "/api/articles", nil)
	req.Host = "127.0.0.1:8082"
	req.Header.Set("X-Test-IP", "127.0.0.1")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected direct local status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}

func TestFrontendGuardAllowsCookieMutationFromConfiguredOriginOnInternalHost(t *testing.T) {
app := newFrontendGuardTestApp()

req := httptest.NewRequest(http.MethodPost, "/api/account/profile", nil)
req.Host = "backend.internal"
req.Header.Set("Origin", "https://imanjo.com")
req.Header.Set("Cookie", "token=session-token")
req.Header.Set("X-Forwarded-For", "198.51.100.10")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("app.Test failed: %v", err)
}
if resp.StatusCode != fiber.StatusNoContent {
t.Fatalf("expected configured-origin cookie mutation status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
}
}

func TestFrontendGuardBlocksCookieMutationFromUntrustedOriginOnInternalHost(t *testing.T) {
app := newFrontendGuardTestApp()

req := httptest.NewRequest(http.MethodPost, "/api/account/profile", nil)
req.Host = "backend.internal"
req.Header.Set("Origin", "https://attacker.example")
req.Header.Set("Cookie", "token=session-token")
req.Header.Set("X-Forwarded-For", "198.51.100.10")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("app.Test failed: %v", err)
}
if resp.StatusCode != fiber.StatusForbidden {
t.Fatalf("expected untrusted cookie mutation status %d, got %d", fiber.StatusForbidden, resp.StatusCode)
}
}

func TestFrontendGuardBlocksCookieMutationWithoutBrowserSource(t *testing.T) {
app := newFrontendGuardTestApp()

req := httptest.NewRequest(http.MethodPost, "/api/account/profile", nil)
req.Host = "backend.internal"
req.Header.Set("Cookie", "refresh_token=refresh-token")
req.Header.Set("X-Forwarded-For", "198.51.100.10")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("app.Test failed: %v", err)
}
if resp.StatusCode != fiber.StatusForbidden {
t.Fatalf("expected missing-source cookie mutation status %d, got %d", fiber.StatusForbidden, resp.StatusCode)
}
}

func TestFrontendGuardAllowsBFFCookieMutation(t *testing.T) {
app := newFrontendGuardTestApp()

req := httptest.NewRequest(http.MethodPost, "/api/account/profile", nil)
req.Host = "backend.internal"
req.Header.Set("Cookie", "token=session-token")
req.Header.Set("X-Frontend-Key", "frontend-secret")
req.Header.Set("X-Forwarded-For", "198.51.100.10")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("app.Test failed: %v", err)
}
if resp.StatusCode != fiber.StatusNoContent {
t.Fatalf("expected BFF cookie mutation status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
}
}

func TestFrontendGuardKeepsBearerMutationCompatibleWithoutCookie(t *testing.T) {
app := newFrontendGuardTestApp()

req := httptest.NewRequest(http.MethodPost, "/api/account/profile", nil)
req.Host = "backend.internal"
req.Header.Set("Authorization", "Bearer access-token")
req.Header.Set("X-Forwarded-For", "198.51.100.10")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("app.Test failed: %v", err)
}
if resp.StatusCode != fiber.StatusNoContent {
t.Fatalf("expected bearer mutation status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
}
}

func TestFrontendGuardAllowsCookieMutationWithConfiguredReferer(t *testing.T) {
app := newFrontendGuardTestApp()

req := httptest.NewRequest(http.MethodPost, "/api/account/profile", nil)
req.Host = "backend.internal"
req.Header.Set("Referer", "https://www.imanjo.com/dashboard")
req.Header.Set("Cookie", "token=session-token")
req.Header.Set("X-Forwarded-For", "198.51.100.10")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("app.Test failed: %v", err)
}
if resp.StatusCode != fiber.StatusNoContent {
t.Fatalf("expected configured-referer cookie mutation status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
}
}

func TestFrontendGuardKeepsOAuthCallbackCompatibleWithCookie(t *testing.T) {
app := newFrontendGuardTestApp()

req := httptest.NewRequest(http.MethodGet, "/api/auth/google/redirect", nil)
req.Host = "backend.internal"
req.Header.Set("Cookie", "token=session-token")
req.Header.Set("X-Forwarded-For", "198.51.100.10")

resp, err := app.Test(req)
if err != nil {
t.Fatalf("app.Test failed: %v", err)
}
if resp.StatusCode != fiber.StatusNoContent {
t.Fatalf("expected OAuth callback compatibility status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
}
}
