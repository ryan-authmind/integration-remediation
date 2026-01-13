package integrations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type SlackClient struct {
	WebhookURL string
	Client     *http.Client
}

type SlackPayload struct {
	Text      string                   `json:"text,omitempty"`
	Blocks    []map[string]interface{} `json:"blocks,omitempty"`
	Username  string                   `json:"username,omitempty"`
	IconEmoji string                   `json:"icon_emoji,omitempty"`
}

func (s *SlackClient) SendNotification(message string) error {
	payload := SlackPayload{
		Text:      message,
		Username:  "RemediationBot",
		IconEmoji: ":robot_face:",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", s.WebhookURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := s.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Slack error: %s", resp.Status)
	}

	return nil
}
