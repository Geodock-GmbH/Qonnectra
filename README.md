# Todos

## Backend

- [ ] Apps
    - [ ] API
        - [ ] Node model and serializer
        - [ ] Address model and serializer
        - [ ] Residential unit model and serializer
        - [ ] Area model and serializer
    - [ ] Admin
- [ ] Geoserver init through API and shell script
- [ ] QGIS-Server through admin django panel. Sharing project folder via docker volumes, DJ Model + admin
- [ ] Storage SameSite problem
    - [ ] After auth has been implemented, this could be a problem,
          Since the first part in the file path is always the same user.
          Proxy downloads through django or nginx?
- [ ] Better nextcloud storage integration
    - [ ] Nextcloud File Uploader User. occ not possible in docker compose up?
    - [ ] Run the occ command to create the user manually?
    - [ ] docker-compose exec -u www-data nextcloud_app php /var/www/html/occ user:add newuser
- [ ] Documentation through django admin docs
- [ ] i18n and localization
- [x] DRF JWT Authentication
- [ ] Tests
- [ ] django tenants
- [ ] django websockets

## Frontend

- [ ] UI
    - [ ] Map
    - [ ] Layer List
    - [ ] Layer Detail
    - [ ] Login
    - [ ] Register
    - [ ] Forgot Password
    - [ ] Reset Password


## Copy the caddy root ca certificate from docker
1. Linux:
```bash
docker volume ls | grep caddy_data 
docker volume inspect <full_volume_name> (example output: /var/lib/docker/volumes/deployment_caddy_data/_data)
sudo cp <volume_mount_point>/caddy/pki/authorities/local/root.crt ~/caddy_root.crt
sudo chown $USER:$USER ~/caddy_root.crt
sudo mv ~/caddy_root.crt /usr/local/share/ca-certificates/caddy_root.crt
sudo update-ca-certificates
```

## Edit hostfile

1. Linux/macOS:
/etc/hosts
```bash
sudo nano /etc/hosts
```

2. Windows
C:\Windows\System32\drivers\etc\hosts


Add something like:     127.0.0.1 geoserver.localhost app.localhost api.localhost cloud.localhost


