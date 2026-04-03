package cache_test

import (
	"testing"
	"time"

	"github.com/tosly/backend/cache"
)

func TestCache_SetAndGet(t *testing.T) {
	c := cache.New(1 * time.Hour)

	c.Set("spotify.com", []byte(`{"severity":"red"}`))

	val, ok := c.Get("spotify.com")
	if !ok {
		t.Fatal("expected cache hit, got miss")
	}
	if string(val) != `{"severity":"red"}` {
		t.Fatalf("unexpected value: %s", val)
	}
}

func TestCache_Miss(t *testing.T) {
	c := cache.New(1 * time.Hour)

	_, ok := c.Get("unknown.com")
	if ok {
		t.Fatal("expected cache miss, got hit")
	}
}

func TestCache_Expiry(t *testing.T) {
	c := cache.New(50 * time.Millisecond)

	c.Set("spotify.com", []byte(`{"severity":"red"}`))

	time.Sleep(100 * time.Millisecond)

	_, ok := c.Get("spotify.com")
	if ok {
		t.Fatal("expected expired entry to be a miss")
	}
}

func TestCache_Overwrite(t *testing.T) {
	c := cache.New(1 * time.Hour)

	c.Set("spotify.com", []byte(`{"severity":"red"}`))
	c.Set("spotify.com", []byte(`{"severity":"green"}`))

	val, ok := c.Get("spotify.com")
	if !ok {
		t.Fatal("expected cache hit")
	}
	if string(val) != `{"severity":"green"}` {
		t.Fatalf("unexpected value: %s", val)
	}
}
