package cache

import (
	"sync"
	"time"
)

type entry struct {
	value     []byte
	expiresAt time.Time
}

type Cache struct {
	mu  sync.RWMutex
	ttl time.Duration
	m   map[string]entry
}

func New(ttl time.Duration) *Cache {
	return &Cache{
		ttl: ttl,
		m:   make(map[string]entry),
	}
}

func (c *Cache) Set(key string, value []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.m[key] = entry{value: value, expiresAt: time.Now().Add(c.ttl)}
}

func (c *Cache) Get(key string) ([]byte, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.m[key]
	if !ok {
		return nil, false
	}
	if time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.value, true
}
